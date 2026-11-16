//! The citation fence. The cloud may only use numbers, codes, dates, and
//! gloss ids that are already in the sealed packet. Anything else is dropped
//! before it reaches the call sheet.

use std::collections::HashSet;

use crate::model::{CloudDraft, Dropped, DraftSentence, Extraction, SealedPacket, Verdict};
use crate::rules::{allowed_citations, allowed_codes, allowed_dates, allowed_numbers};

struct NumberToken {
    raw: String,
    cents: i64,
    start: usize,
}

/// Find ISO date spans so their digits are not mistaken for amounts.
fn date_spans(text: &str) -> Vec<(usize, usize)> {
    let bytes = text.as_bytes();
    let mut spans = Vec::new();
    let mut i = 0;
    while i + 10 <= bytes.len() {
        let slice = &text[i..i + 10];
        if is_iso_date(slice) {
            spans.push((i, i + 10));
            i += 10;
        } else {
            i += 1;
        }
    }
    spans
}

fn is_iso_date(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 10
        && b[0..4].iter().all(|c| c.is_ascii_digit())
        && b[4] == b'-'
        && b[5..7].iter().all(|c| c.is_ascii_digit())
        && b[7] == b'-'
        && b[8..10].iter().all(|c| c.is_ascii_digit())
}

fn in_spans(pos: usize, spans: &[(usize, usize)]) -> bool {
    spans.iter().any(|(s, e)| pos >= *s && pos < *e)
}

fn iso_dates(text: &str) -> Vec<String> {
    date_spans(text)
        .iter()
        .map(|(start, end)| text[*start..*end].to_string())
        .collect()
}

fn digits_only(value: &str) -> String {
    value.chars().filter(|c| c.is_ascii_digit()).collect()
}

const COMMON_NAME_WORDS: [&str; 12] = [
    "patient", "member", "account", "claim", "office", "billing", "service", "amount",
    "total", "provider", "insurance", "hospital",
];

const ADVICE_QUESTION: [&str; 9] = [
    "do not pay", "don't pay", "dont pay", "refuse to pay", "withhold payment",
    "this is fraud", "fraudulent charge", "illegal charge", "lawsuit",
];

const ADVICE_IMPERATIVE: [&str; 14] = [
    "do not pay", "don't pay", "dont pay", "refuse to pay", "withhold", "dispute this charge",
    "this is fraud", "fraudulent", "illegal charge", "lawsuit", "sue the", "attorney",
    "legal action", "report them",
];

fn scan_numbers(text: &str) -> Vec<NumberToken> {
    let bytes = text.as_bytes();
    let mut out = Vec::new();
    let mut i = 0;
    while i < bytes.len() {
        let c = bytes[i];
        if c == b'$' || c.is_ascii_digit() {
            let start = i;
            let mut j = i;
            if bytes[j] == b'$' {
                j += 1;
            }
            let mut seen_digit = false;
            let mut seen_dot = false;
            while j < bytes.len() {
                let cj = bytes[j];
                if cj.is_ascii_digit() {
                    seen_digit = true;
                    j += 1;
                } else if cj == b',' && seen_digit {
                    j += 1;
                } else if cj == b'.' && !seen_dot {
                    seen_dot = true;
                    j += 1;
                } else {
                    break;
                }
            }
            if seen_digit && j > start {
                let raw = text[start..j].to_string();
                let cleaned: String = raw.chars().filter(|c| *c != '$' && *c != ',').collect();
                if let Ok(val) = cleaned.parse::<f64>() {
                    let cents = (val * 100.0).round() as i64;
                    out.push(NumberToken {
                        raw,
                        cents,
                        start,
                    });
                }
                i = j;
                continue;
            }
        }
        i += 1;
    }
    out
}

/// Extract `g-...` citations.
fn citations(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut rest = text;
    while let Some(idx) = rest.find("g-") {
        let after = &rest[idx + 2..];
        let end = after
            .find(|c: char| !(c.is_ascii_alphanumeric() || c == '-'))
            .unwrap_or(after.len());
        if end > 0 {
            out.push(format!("g-{}", &after[..end]));
        }
        rest = &rest[idx + 2 + end..];
    }
    out
}

fn private_hit(text: &str, extraction: &Extraction) -> Option<String> {
    let lower = text.to_lowercase();
    let fields = [
        ("patient name", &extraction.private.patient_name),
        ("member id", &extraction.private.member_id),
        ("account number", &extraction.private.account_number),
        ("provider name", &extraction.private.provider_name),
        ("provider phone", &extraction.private.provider_phone),
        ("service address", &extraction.private.service_address),
    ];
    for (label, value) in fields {
        let v = value.trim();
        if v.is_empty() {
            continue;
        }
        if lower.contains(&v.to_lowercase()) {
            return Some(label.to_string());
        }
    }

    // A name may be split across the sentence. Match any distinctive token.
    let name = extraction.private.patient_name.trim();
    if name.len() > 2 {
        for token in name.split_whitespace() {
            let token = token.trim();
            if token.len() > 3 && !COMMON_NAME_WORDS.contains(&token.to_lowercase().as_str()) {
                if lower.contains(&token.to_lowercase()) {
                    return Some("patient name".to_string());
                }
            }
        }
    }

    // Digit identifiers survive reformatting: 555-014-2280 vs 5550142280.
    for (label, value) in [
        ("member id", &extraction.private.member_id),
        ("account number", &extraction.private.account_number),
        ("provider phone", &extraction.private.provider_phone),
    ] {
        let digits = digits_only(value);
        if digits.len() >= 7 && digits_only(text).contains(&digits) {
            return Some(label.to_string());
        }
    }

    None
}

fn advice_hit(text: &str) -> bool {
    let lower = text.to_lowercase();
    let is_question = text.trim_end().ends_with('?');
    let patterns = if is_question {
        ADVICE_QUESTION.as_slice()
    } else {
        ADVICE_IMPERATIVE.as_slice()
    };
    patterns.iter().any(|pattern| lower.contains(pattern))
}

/// Verify a cloud draft against the packet. Returns the sentences that may be
/// shown, and the ones that were dropped, with the reason.
pub fn verify_draft(
    packet: &SealedPacket,
    extraction: &Extraction,
    draft: &CloudDraft,
) -> Verdict {
    let numbers = allowed_numbers(packet);
    let codes = allowed_codes(packet);
    let dates: HashSet<String> = allowed_dates(packet)
        .into_iter()
        .map(|value| value.to_string())
        .collect();
    let allowed_cites = allowed_citations(packet);
    let max_line = packet.lines.len() as i64;
    let line_amounts: HashSet<i64> = packet
        .lines
        .iter()
        .flat_map(|line| {
            [
                line.billed_cents,
                line.allowed_cents,
                line.plan_paid_cents,
                line.patient_cents,
            ]
        })
        .collect();
    // Packet-level amounts (printed totals, check differences) may appear next to
    // any code. Line amounts may only appear next to their own code.
    let packet_level: HashSet<i64> = numbers.difference(&line_amounts).cloned().collect();

    let mut accepted = Vec::new();
    let mut dropped = Vec::new();

    for sentence in &draft.sentences {
        let text = sentence.text.trim().to_string();
        if text.is_empty() {
            dropped.push(Dropped {
                text,
                reason: "empty sentence".into(),
            });
            continue;
        }

        if let Some(field) = private_hit(&text, extraction) {
            dropped.push(Dropped {
                text,
                reason: format!("mentions a private field: {field}"),
            });
            continue;
        }

        let citation = sentence.citation.as_deref().and_then(|value| {
          let trimmed = value.trim();
          if trimmed.is_empty()
            || trimmed.eq_ignore_ascii_case("null")
            || trimmed.eq_ignore_ascii_case("none")
          {
            None
          } else {
            Some(trimmed)
          }
        });

        if let Some(citation) = citation {
          if !allowed_cites.contains(citation) {
            dropped.push(Dropped {
              text,
              reason: format!("unknown citation {citation}"),
            });
            continue;
          }
        }

        let spans = date_spans(&text);
        let tokens = scan_numbers(&text);
        let mut bad: Option<String> = None;

        let sentence_codes: Vec<&str> = tokens
            .iter()
            .filter(|token| !in_spans(token.start, &spans))
            .filter(|token| !token.raw.starts_with('$') && !token.raw.contains('.'))
            .filter_map(|token| token.raw.parse::<i64>().ok().map(|value| (token.raw.as_str(), value)))
            .filter(|(_, value)| (1000..=99999).contains(value))
            .filter(|(raw, _)| codes.contains(raw))
            .map(|(raw, _)| raw)
            .collect();

        for date in iso_dates(&text) {
            if !dates.contains(&date) {
                bad = Some(format!("date {date} is not in the packet"));
                break;
            }
        }

        if bad.is_none() {
            for token in &tokens {
                if in_spans(token.start, &spans) {
                    continue;
                }
                let is_money = token.raw.starts_with('$') || token.raw.contains('.');
                if !is_money {
                    if let Ok(int_value) = token.raw.parse::<i64>() {
                        if (1000..=99999).contains(&int_value) && codes.contains(token.raw.as_str()) {
                            continue;
                        }
                        // A bare small integer is a line number or a count, not a
                        // dollar amount. Money is written with $ or a decimal.
                        if int_value <= max_line + 10 {
                            continue;
                        }
                    }
                }
                if packet_level.contains(&token.cents) {
                    continue;
                }
                if !sentence_codes.is_empty() {
                    let belongs = packet.lines.iter().any(|line| {
                        sentence_codes.contains(&line.code.as_str())
                            && (line.billed_cents == token.cents
                                || line.allowed_cents == token.cents
                                || line.plan_paid_cents == token.cents
                                || line.patient_cents == token.cents)
                    });
                    if belongs {
                        continue;
                    }
                    bad = Some(format!(
                        "amount ${:.2} is not a charge for the code named here",
                        token.cents as f64 / 100.0
                    ));
                    break;
                }
                if numbers.contains(&token.cents) {
                    continue;
                }
                bad = Some(format!(
                    "amount ${:.2} is not in the packet",
                    token.cents as f64 / 100.0
                ));
                break;
            }
        }

        if bad.is_none() {
            for citation in citations(&text) {
                if !allowed_cites.contains(&citation.as_str()) {
                    bad = Some(format!("unknown citation {citation}"));
                    break;
                }
            }
        }

        if bad.is_none() {
            // Any 4-5 digit token that is neither a code nor an allowed amount.
            for token in &tokens {
                if in_spans(token.start, &spans) {
                    continue;
                }
                if token.raw.starts_with('$') || token.raw.contains('.') {
                    continue;
                }
                if let Ok(int_value) = token.raw.parse::<i64>() {
                    if (1000..=99999).contains(&int_value)
                        && !codes.contains(token.raw.as_str())
                        && !numbers.contains(&token.cents)
                    {
                        bad = Some(format!("code {} is not in the packet", token.raw));
                        break;
                    }
                }
            }
        }

        if bad.is_none() && advice_hit(&text) {
            bad = Some("advisory language is not allowed".into());
        }

        if let Some(reason) = bad {
            dropped.push(Dropped { text, reason });
        } else {
            accepted.push(DraftSentence {
                text,
                citation: citation.map(|value| value.to_string()),
            });
        }
    }

    let ok = dropped.is_empty();
    Verdict {
        ok,
        accepted,
        dropped,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{BillLine, Check, GlossRef, PrivateFields, SealedLine};

    fn packet() -> SealedPacket {
        SealedPacket {
            lines: vec![
                SealedLine {
                    date: "2026-10-02".into(),
                    code: "99213".into(),
                    billed_cents: 18000,
                    allowed_cents: 12800,
                    plan_paid_cents: 10200,
                    patient_cents: 2600,
                },
                SealedLine {
                    date: "2026-10-02".into(),
                    code: "99213".into(),
                    billed_cents: 18000,
                    allowed_cents: 12800,
                    plan_paid_cents: 10200,
                    patient_cents: 2600,
                },
                SealedLine {
                    date: "2026-10-02".into(),
                    code: "85025".into(),
                    billed_cents: 9000,
                    allowed_cents: 6200,
                    plan_paid_cents: 4900,
                    patient_cents: 1300,
                },
            ],
            printed_amount_due_cents: 14600,
            printed_total_billed_cents: None,
            printed_total_patient_cents: None,
            checks: vec![
                Check {
                    id: "total-mismatch".into(),
                    severity: "error".into(),
                    message: "The printed amount due is $146.00. The lines add to $110.00. The difference is $36.00.".into(),
                    line_numbers: vec![1, 2],
                    numbers_cents: vec![11000, 14600, 3600],
                },
                Check {
                    id: "duplicate-99213-2026-10-02".into(),
                    severity: "warning".into(),
                    message: "Code 99213 appears on more than one line on 2026-10-02. The patient share of those lines is $52.00.".into(),
                    line_numbers: vec![1, 2],
                    numbers_cents: vec![2600, 2600, 5200],
                },
            ],
            glossary: vec![GlossRef {
                code: "99213".into(),
                gloss_id: "g-99213".into(),
            }],
        }
    }

    fn extraction() -> Extraction {
        Extraction {
            private: PrivateFields {
                patient_name: "Alex Rivera".into(),
                member_id: "XYC 8842 1170".into(),
                provider_phone: "(555) 014-2280".into(),
                ..Default::default()
            },
            lines: vec![
                BillLine {
                    line: 1,
                    date: "2026-10-02".into(),
                    code: "99213".into(),
                    description: "Office visit, established".into(),
                    billed_cents: 18000,
                    allowed_cents: 12800,
                    plan_paid_cents: 10200,
                    patient_cents: 2600,
                },
                BillLine {
                    line: 2,
                    date: "2026-10-02".into(),
                    code: "99213".into(),
                    description: "Office visit, established".into(),
                    billed_cents: 18000,
                    allowed_cents: 12800,
                    plan_paid_cents: 10200,
                    patient_cents: 2600,
                },
            ],
            printed_amount_due_cents: 14600,
            printed_total_billed_cents: None,
            printed_total_patient_cents: None,
            claim_number: None,
        }
    }

    #[test]
    fn drops_an_amount_that_belongs_to_a_different_code() {
        let draft = CloudDraft {
            sentences: vec![DraftSentence {
                text: "Code 99213 was charged at $13.00.".into(),
                citation: None,
            }],
        };
        let verdict = verify_draft(&packet(), &extraction(), &draft);
        assert!(!verdict.ok, "accepted: {:?}", verdict.accepted);
        assert!(verdict.dropped[0].reason.contains("not a charge for the code"));
    }

    #[test]
    fn drops_a_date_that_is_not_on_the_bill() {
        let draft = CloudDraft {
            sentences: vec![DraftSentence {
                text: "Was code 99213 performed on 2026-12-25?".into(),
                citation: None,
            }],
        };
        let verdict = verify_draft(&packet(), &extraction(), &draft);
        assert!(!verdict.ok);
        assert!(verdict.dropped[0].reason.contains("2026-12-25"));
    }

    #[test]
    fn drops_imperative_advice() {
        let draft = CloudDraft {
            sentences: vec![DraftSentence {
                text: "Do not pay this bill until they send an itemized statement.".into(),
                citation: None,
            }],
        };
        let verdict = verify_draft(&packet(), &extraction(), &draft);
        assert!(!verdict.ok);
        assert!(verdict.dropped[0].reason.contains("advisory"));
    }

    #[test]
    fn allows_a_question_that_mentions_disputing() {
        let draft = CloudDraft {
            sentences: vec![DraftSentence {
                text: "Should I dispute this charge with the billing office?".into(),
                citation: None,
            }],
        };
        let verdict = verify_draft(&packet(), &extraction(), &draft);
        assert!(verdict.ok, "dropped: {:?}", verdict.dropped);
    }

    #[test]
    fn drops_a_reformatted_phone_number() {
        let draft = CloudDraft {
            sentences: vec![DraftSentence {
                text: "Please call me back at 5550142280.".into(),
                citation: None,
            }],
        };
        let verdict = verify_draft(&packet(), &extraction(), &draft);
        assert!(!verdict.ok);
        assert!(verdict.dropped[0].reason.contains("phone"));
    }

    #[test]
    fn treats_the_string_null_as_no_citation() {
        let draft = CloudDraft {
            sentences: vec![DraftSentence {
                text: "The printed amount due is $146.00 and the lines add to $110.00.".into(),
                citation: Some("null".into()),
            }],
        };
        let verdict = verify_draft(&packet(), &extraction(), &draft);
        assert!(verdict.ok, "dropped: {:?}", verdict.dropped);
        assert!(verdict.accepted[0].citation.is_none());
    }

    #[test]
    fn accepts_a_check_id_citation() {
        let draft = CloudDraft {
            sentences: vec![DraftSentence {
                text: "The printed amount due is $146.00 and the lines add to $110.00.".into(),
                citation: Some("total-mismatch".into()),
            }],
        };
        let verdict = verify_draft(&packet(), &extraction(), &draft);
        assert!(verdict.ok, "dropped: {:?}", verdict.dropped);
    }

    #[test]
    fn accepts_a_duplicate_question_with_a_line_count() {
        let draft = CloudDraft {
            sentences: vec![DraftSentence {
                text: "Code 99213 appears on 2 lines. The patient share is $52.00. Was it billed twice?".into(),
                citation: None,
            }],
        };
        let verdict = verify_draft(&packet(), &extraction(), &draft);
        assert!(verdict.ok, "dropped: {:?}", verdict.dropped);
    }

    #[test]
    fn accepts_a_sentence_that_only_uses_packet_numbers() {
        let draft = CloudDraft {
            sentences: vec![DraftSentence {
                text: "The printed amount due is $146.00 and the lines add to $110.00.".into(),
                citation: None,
            }],
        };
        let verdict = verify_draft(&packet(), &extraction(), &draft);
        assert!(verdict.ok);
        assert_eq!(verdict.accepted.len(), 1);
    }

    #[test]
    fn drops_a_sentence_with_a_number_that_was_not_in_the_packet() {
        let draft = CloudDraft {
            sentences: vec![DraftSentence {
                text: "You should ask about the $999.00 facility fee.".into(),
                citation: None,
            }],
        };
        let verdict = verify_draft(&packet(), &extraction(), &draft);
        assert!(!verdict.ok);
        assert!(verdict.dropped[0].reason.contains("999.00"));
    }

    #[test]
    fn drops_a_sentence_that_names_the_patient() {
        let draft = CloudDraft {
            sentences: vec![DraftSentence {
                text: "Alex Rivera was charged twice.".into(),
                citation: None,
            }],
        };
        let verdict = verify_draft(&packet(), &extraction(), &draft);
        assert!(!verdict.ok);
        assert!(verdict.dropped[0].reason.contains("private"));
    }

    #[test]
    fn drops_an_unknown_citation() {
        let draft = CloudDraft {
            sentences: vec![DraftSentence {
                text: "Code 99213 is an office visit.".into(),
                citation: Some("g-99999".into()),
            }],
        };
        let verdict = verify_draft(&packet(), &extraction(), &draft);
        assert!(!verdict.ok);
        assert!(verdict.dropped[0].reason.contains("g-99999"));
    }

    #[test]
    fn accepts_a_valid_citation() {
        let draft = CloudDraft {
            sentences: vec![DraftSentence {
                text: "Code 99213 is an office visit for an established patient.".into(),
                citation: Some("g-99213".into()),
            }],
        };
        let verdict = verify_draft(&packet(), &extraction(), &draft);
        assert!(verdict.ok);
    }
}
