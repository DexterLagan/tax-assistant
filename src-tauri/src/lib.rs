use tax_assistant_core::ImportResult;

#[tauri::command]
fn import_csv(csv_text: &str) -> Result<ImportResult, String> {
    tax_assistant_core::import_and_analyze(csv_text).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![import_csv])
        .run(tauri::generate_context!())
        .expect("failed to run Tax Assistant");
}
