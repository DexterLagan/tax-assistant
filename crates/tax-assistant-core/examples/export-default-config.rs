use std::env;
use std::fs;
use std::path::PathBuf;

use tax_assistant_core::default_config;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let destination = env::args_os()
        .nth(1)
        .map_or_else(|| PathBuf::from("tax-assistant.conf"), PathBuf::from);
    let config = serde_json::to_string_pretty(&default_config())?;
    fs::write(&destination, format!("{config}\n"))?;
    println!("Wrote {}", destination.display());
    Ok(())
}
