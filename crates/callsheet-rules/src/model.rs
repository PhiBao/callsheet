//! Data model shared by the browser, the Rust rules engine, and the cloud draft.
//!
//! The important invariant: `Extraction` holds private fields and bill lines.
//! `SealedPacket` holds only what the cloud is allowed to read. Nothing in this
//! crate ever puts a private field into a `SealedPacket`.

use serde::{Deserialize, Serialize};

/// One service line on a bill or explanation of benefits.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BillLine {
    pub line: u32,
    pub date: String,
    pub code: String,
    pub description: String,
    pub billed_cents: i64,
    pub allowed_cents: i64,
    pub plan_paid_cents: i64,
    pub patient_cents: i64,
}

/// Fields that never leave the browser.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct PrivateFields {
    pub patient_name: String,
    pub member_id: String,
    pub account_number: String,
    pub provider_name: String,
    pub provider_phone: String,
    pub service_address: String,
}

/// The on-device model's structured read of one document.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Extraction {
    pub private: PrivateFields,
    pub lines: Vec<BillLine>,
    pub printed_amount_due_cents: i64,
    pub printed_total_billed_cents: Option<i64>,
    pub printed_total_patient_cents: Option<i64>,
    pub claim_number: Option<String>,
}

/// A line with the private fields and the free-text description removed.
/// The cloud gets codes and amounts only; descriptions stay on the device.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SealedLine {
    pub date: String,
    pub code: String,
    pub billed_cents: i64,
    pub allowed_cents: i64,
    pub plan_paid_cents: i64,
    pub patient_cents: i64,
}

/// A deterministic finding. `numbers_cents` lists every amount the message may
/// legitimately mention, so the citation fence can allow it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Check {
    pub id: String,
    pub severity: String,
    pub message: String,
    pub line_numbers: Vec<u32>,
    pub numbers_cents: Vec<i64>,
}

/// A glossary entry the cloud is allowed to cite.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GlossRef {
    pub code: String,
    pub gloss_id: String,
}

/// The exact bytes the cloud may read.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SealedPacket {
    pub lines: Vec<SealedLine>,
    pub printed_amount_due_cents: i64,
    pub printed_total_billed_cents: Option<i64>,
    pub printed_total_patient_cents: Option<i64>,
    pub checks: Vec<Check>,
    pub glossary: Vec<GlossRef>,
}

/// One sentence returned by the cloud.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DraftSentence {
    pub text: String,
    pub citation: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CloudDraft {
    pub sentences: Vec<DraftSentence>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Dropped {
    pub text: String,
    pub reason: String,
}

/// Result of the citation fence.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Verdict {
    pub ok: bool,
    pub accepted: Vec<DraftSentence>,
    pub dropped: Vec<Dropped>,
}

/// The finished sheet, after local values are put back.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CallSheet {
    pub heading: String,
    pub questions: Vec<String>,
    pub phone: String,
    pub disclaimer: String,
}
