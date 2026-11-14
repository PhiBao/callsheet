//! Callsheet rules engine.
//!
//! Three jobs, all deterministic:
//! - `rules`: turn a private extraction into a sealed packet and a list of checks.
//! - `verify`: drop any cloud sentence that uses a number, code, or gloss the
//!   packet did not contain.
//! - `wasm`: the same code, in the browser, so the fence runs before anything
//!   is sent.

pub mod model;
pub mod rules;
pub mod verify;

#[cfg(target_arch = "wasm32")]
pub mod wasm;

pub use model::*;
pub use rules::{all_checks, seal};
pub use verify::verify_draft;

#[cfg(test)]
pub mod tests {
    use crate::model::{
        BillLine, Extraction, PrivateFields,
    };

    /// The synthetic sample bill in `fixtures/sample-bill.txt`.
    pub fn sample_extraction() -> Extraction {
        Extraction {
            private: PrivateFields {
                patient_name: "Alex Rivera".into(),
                member_id: "XYC 8842 1170".into(),
                account_number: "000-4471-002".into(),
                provider_name: "Riverside Outpatient Clinic".into(),
                provider_phone: "(555) 014-2280".into(),
                service_address: "1200 Harbor Boulevard, Springfield".into(),
            },
            lines: vec![
                line(1, "99213", "Office visit, established", 18000, 12800, 10200, 2600),
                line(2, "99213", "Office visit, established", 18000, 12800, 10200, 2600),
                line(3, "85025", "Complete blood count", 9000, 6200, 4900, 1300),
                line(4, "80053", "Metabolic panel", 12000, 8400, 6700, 1700),
                line(5, "71046", "Chest X-ray, 2 views", 20000, 14000, 11200, 2800),
            ],
            printed_amount_due_cents: 14600,
            printed_total_billed_cents: Some(77000),
            printed_total_patient_cents: Some(11000),
            claim_number: Some("CLM-2026-1002-8841".into()),
        }
    }

    fn line(
        n: u32,
        code: &str,
        description: &str,
        billed: i64,
        allowed: i64,
        plan_paid: i64,
        patient: i64,
    ) -> BillLine {
        BillLine {
            line: n,
            date: "2026-10-02".into(),
            code: code.into(),
            description: description.into(),
            billed_cents: billed,
            allowed_cents: allowed,
            plan_paid_cents: plan_paid,
            patient_cents: patient,
        }
    }
}
