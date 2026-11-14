//! Deterministic checks. The model never runs these; the model cannot change
//! the verdict.

use std::collections::{HashMap, HashSet};

use crate::model::{
    BillLine, CallSheet, Check, Extraction, GlossRef, PrivateFields, SealedLine, SealedPacket,
};

/// Group lines by (date, code) and flag any code that appears twice on the same day.
pub fn duplicate_lines(extraction: &Extraction) -> Vec<Check> {
    let mut groups: HashMap<(String, String), Vec<&BillLine>> = HashMap::new();
    for line in &extraction.lines {
        groups
            .entry((line.date.clone(), line.code.clone()))
            .or_default()
            .push(line);
    }

    let mut checks = Vec::new();
    for ((date, code), lines) in groups {
        if lines.len() < 2 {
            continue;
        }
        let numbers: Vec<i64> = lines.iter().map(|l| l.patient_cents).collect();
        let total: i64 = numbers.iter().sum();
        let line_numbers: Vec<u32> = lines.iter().map(|l| l.line).collect();
        checks.push(Check {
            id: format!("duplicate-{code}-{date}"),
            severity: "warning".into(),
            message: format!(
                "Code {code} appears on more than one line on {date}. The patient share of those lines is ${total:.2}.",
                total = cents(total)
            ),
            line_numbers,
            numbers_cents: {
                let mut v = numbers.clone();
                v.push(total);
                v
            },
        });
    }
    checks.sort_by(|a, b| a.id.cmp(&b.id));
    checks
}

/// The printed amount due must equal the sum of the patient-share lines.
pub fn total_mismatch(extraction: &Extraction) -> Vec<Check> {
    let sum: i64 = extraction.lines.iter().map(|l| l.patient_cents).sum();
    if sum == extraction.printed_amount_due_cents {
        return Vec::new();
    }
    let difference = extraction.printed_amount_due_cents - sum;
    vec![Check {
        id: "total-mismatch".into(),
        severity: "error".into(),
        message: format!(
            "The printed amount due is ${printed:.2}. The lines add to ${sum:.2}. The difference is ${difference:.2}.",
            printed = cents(extraction.printed_amount_due_cents),
            sum = cents(sum),
            difference = cents(difference.abs()),
        ),
        line_numbers: extraction.lines.iter().map(|l| l.line).collect(),
        numbers_cents: vec![sum, extraction.printed_amount_due_cents, difference.abs()],
    }]
}

/// If the bill prints column totals, they must match the sum of the lines.
pub fn column_totals(extraction: &Extraction) -> Vec<Check> {
    let mut checks = Vec::new();
    let sum_billed: i64 = extraction.lines.iter().map(|l| l.billed_cents).sum();
    let sum_patient: i64 = extraction.lines.iter().map(|l| l.patient_cents).sum();

    if let Some(printed) = extraction.printed_total_billed_cents {
        if printed != sum_billed {
            checks.push(Check {
                id: "total-billed-mismatch".into(),
                severity: "error".into(),
                message: format!(
                    "The printed total billed is ${printed:.2}. The lines add to ${sum:.2}.",
                    printed = cents(printed),
                    sum = cents(sum_billed),
                ),
                line_numbers: extraction.lines.iter().map(|l| l.line).collect(),
                numbers_cents: vec![sum_billed, printed, (printed - sum_billed).abs()],
            });
        }
    }

    if let Some(printed) = extraction.printed_total_patient_cents {
        if printed != sum_patient {
            checks.push(Check {
                id: "total-patient-mismatch".into(),
                severity: "error".into(),
                message: format!(
                    "The printed patient responsibility is ${printed:.2}. The lines add to ${sum:.2}.",
                    printed = cents(printed),
                    sum = cents(sum_patient),
                ),
                line_numbers: extraction.lines.iter().map(|l| l.line).collect(),
                numbers_cents: vec![sum_patient, printed, (printed - sum_patient).abs()],
            });
        }
    }

    checks
}

/// Any negative or zero line is worth a question.
pub fn odd_amounts(extraction: &Extraction) -> Vec<Check> {
    let mut checks = Vec::new();
    for line in &extraction.lines {
        if line.patient_cents < 0 {
            checks.push(Check {
                id: format!("negative-patient-{}", line.line),
                severity: "warning".into(),
                message: format!(
                    "Line {} has a negative patient share of ${:.2}.",
                    line.line,
                    cents(line.patient_cents)
                ),
                line_numbers: vec![line.line],
                numbers_cents: vec![line.patient_cents.abs()],
            });
        }
        if line.patient_cents == 0 && line.billed_cents > 0 {
            checks.push(Check {
                id: format!("zero-patient-{}", line.line),
                severity: "info".into(),
                message: format!(
                    "Line {} is billed at ${:.2} but the patient share is $0.00.",
                    line.line,
                    cents(line.billed_cents)
                ),
                line_numbers: vec![line.line],
                numbers_cents: vec![line.billed_cents],
            });
        }
    }
    checks
}

/// Every deterministic check, in a stable order.
pub fn all_checks(extraction: &Extraction) -> Vec<Check> {
    let mut checks = Vec::new();
    checks.extend(duplicate_lines(extraction));
    checks.extend(total_mismatch(extraction));
    checks.extend(column_totals(extraction));
    checks.extend(odd_amounts(extraction));
    checks.sort_by(|a, b| (severity_rank(&a.severity), a.id.clone()).cmp(&(severity_rank(&b.severity), b.id.clone())));
    checks.dedup_by(|a, b| a.id == b.id);
    checks
}

fn severity_rank(severity: &str) -> u8 {
    match severity {
        "error" => 0,
        "warning" => 1,
        _ => 2,
    }
}

/// Build the packet the cloud is allowed to read. Private fields are dropped
/// here, at the boundary, not filtered later.
pub fn seal(extraction: &Extraction, glossary: &[GlossRef]) -> SealedPacket {
    let lines: Vec<SealedLine> = extraction
        .lines
        .iter()
        .map(|l| SealedLine {
            date: l.date.clone(),
            code: l.code.clone(),
            description: l.description.clone(),
            billed_cents: l.billed_cents,
            allowed_cents: l.allowed_cents,
            plan_paid_cents: l.plan_paid_cents,
            patient_cents: l.patient_cents,
        })
        .collect();

    let mut seen = HashSet::new();
    let mut refs: Vec<GlossRef> = Vec::new();
    for line in &extraction.lines {
        if !seen.insert(line.code.clone()) {
            continue;
        }
        if let Some(found) = glossary.iter().find(|g| g.code == line.code) {
            refs.push(found.clone());
        }
    }

    SealedPacket {
        lines,
        printed_amount_due_cents: extraction.printed_amount_due_cents,
        printed_total_billed_cents: extraction.printed_total_billed_cents,
        printed_total_patient_cents: extraction.printed_total_patient_cents,
        checks: all_checks(extraction),
        glossary: refs,
    }
}

/// Every amount the cloud is allowed to mention.
pub fn allowed_numbers(packet: &SealedPacket) -> HashSet<i64> {
    let mut set = HashSet::new();
    for line in &packet.lines {
        set.insert(line.billed_cents);
        set.insert(line.allowed_cents);
        set.insert(line.plan_paid_cents);
        set.insert(line.patient_cents);
    }
    set.insert(packet.printed_amount_due_cents);
    if let Some(v) = packet.printed_total_billed_cents {
        set.insert(v);
    }
    if let Some(v) = packet.printed_total_patient_cents {
        set.insert(v);
    }
    for check in &packet.checks {
        for n in &check.numbers_cents {
            set.insert(*n);
        }
    }
    set
}

/// The dates the cloud is allowed to mention.
pub fn allowed_dates(packet: &SealedPacket) -> HashSet<&str> {
    packet.lines.iter().map(|l| l.date.as_str()).collect()
}

/// The codes the cloud is allowed to mention.
pub fn allowed_codes(packet: &SealedPacket) -> HashSet<&str> {
    packet.lines.iter().map(|l| l.code.as_str()).collect()
}

/// The gloss ids the cloud is allowed to cite.
pub fn allowed_citations(packet: &SealedPacket) -> HashSet<&str> {
    packet.glossary.iter().map(|g| g.gloss_id.as_str()).collect()
}

/// Assemble the finished sheet from accepted sentences and local values.
/// The phone number is filled in here, after the draft is verified.
pub fn fill_sheet(
    heading: &str,
    verdict: &crate::model::Verdict,
    private: &PrivateFields,
    disclaimer: &str,
) -> CallSheet {
    CallSheet {
        heading: heading.to_string(),
        questions: verdict.accepted.iter().map(|s| s.text.clone()).collect(),
        phone: private.provider_phone.clone(),
        disclaimer: disclaimer.to_string(),
    }
}

fn cents(value: i64) -> f64 {
    value as f64 / 100.0
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Extraction {
        crate::tests::sample_extraction()
    }

    #[test]
    fn flags_the_duplicate_visit() {
        let checks = duplicate_lines(&sample());
        assert!(checks.iter().any(|c| c.id == "duplicate-99213-2026-10-02"));
    }

    #[test]
    fn flags_the_total_mismatch() {
        let checks = total_mismatch(&sample());
        let check = checks.iter().find(|c| c.id == "total-mismatch").unwrap();
        assert!(check.message.contains("146.00"));
        assert!(check.message.contains("110.00"));
        assert!(check.message.contains("36.00"));
    }

    #[test]
    fn seal_drops_private_fields() {
        let packet = seal(&sample(), &[]);
        let json = serde_json::to_string(&packet).unwrap();
        assert!(!json.contains("Alex Rivera"));
        assert!(!json.contains("XYC 8842 1170"));
        assert!(!json.contains("(555) 014-2280"));
    }
}
