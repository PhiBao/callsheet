//! Browser bindings. The page calls these so the same Rust that the tests
//! exercise is the code that fences the cloud draft.

use wasm_bindgen::prelude::*;

use crate::model::{CloudDraft, Extraction, GlossRef, SealedPacket, Verdict};
use crate::rules::{all_checks, seal};
use crate::verify::verify_draft;

fn err(e: impl std::fmt::Display) -> JsValue {
    JsValue::from_str(&e.to_string())
}

/// All deterministic checks for an extraction.
#[wasm_bindgen]
pub fn checks_json(extraction_json: &str) -> Result<String, JsValue> {
    let extraction: Extraction =
        serde_json::from_str(extraction_json).map_err(err)?;
    serde_json::to_string(&all_checks(&extraction)).map_err(err)
}

/// Build the sealed packet. Private fields are dropped here.
#[wasm_bindgen]
pub fn seal_json(extraction_json: &str, glossary_json: &str) -> Result<String, JsValue> {
    let extraction: Extraction =
        serde_json::from_str(extraction_json).map_err(err)?;
    let glossary: Vec<GlossRef> = serde_json::from_str(glossary_json).map_err(err)?;
    serde_json::to_string(&seal(&extraction, &glossary)).map_err(err)
}

/// Verify a cloud draft. Returns the verdict as JSON.
#[wasm_bindgen]
pub fn verify_json(
    packet_json: &str,
    extraction_json: &str,
    draft_json: &str,
) -> Result<String, JsValue> {
    let packet: SealedPacket = serde_json::from_str(packet_json).map_err(err)?;
    let extraction: Extraction = serde_json::from_str(extraction_json).map_err(err)?;
    let draft: CloudDraft = serde_json::from_str(draft_json).map_err(err)?;
    let verdict: Verdict = verify_draft(&packet, &extraction, &draft);
    serde_json::to_string(&verdict).map_err(err)
}
