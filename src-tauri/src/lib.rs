use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Manager};
use tax_assistant_core::{
    AppConfig, ImportResult, Transaction, analyze_with_config, default_config,
    import_and_analyze_with_config, validate_config,
};

#[tauri::command]
fn import_csv(csv_text: &str, config: AppConfig) -> Result<ImportResult, String> {
    import_and_analyze_with_config(csv_text, &config).map_err(|error| error.to_string())
}

#[tauri::command]
fn reanalyze_transactions(
    transactions: Vec<Transaction>,
    config: AppConfig,
) -> Result<ImportResult, String> {
    analyze_with_config(transactions, &config).map_err(|error| error.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ConfigEnvelope {
    config: AppConfig,
    source: String,
    path: Option<String>,
    portable: bool,
}

fn portable_config_path() -> Result<PathBuf, String> {
    let executable = std::env::current_exe()
        .map_err(|error| format!("could not locate Tax Assistant: {error}"))?;

    #[cfg(target_os = "macos")]
    {
        if let Some(app_bundle) = executable.ancestors().find(|ancestor| {
            ancestor
                .extension()
                .is_some_and(|extension| extension == "app")
        }) {
            let app_parent = app_bundle
                .parent()
                .ok_or_else(|| "could not locate the application folder".to_owned())?;
            return Ok(app_parent.join("tax-assistant.conf"));
        }
    }

    let parent = executable
        .parent()
        .ok_or_else(|| "could not locate the application folder".to_owned())?;
    Ok(parent.join("tax-assistant.conf"))
}

fn user_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|directory| directory.join("tax-assistant.conf"))
        .map_err(|error| format!("could not locate the application configuration folder: {error}"))
}

fn parse_config(path: &Path) -> Result<AppConfig, String> {
    let contents = fs::read_to_string(path)
        .map_err(|error| format!("could not read {}: {error}", path.display()))?;
    let config: AppConfig = serde_json::from_str(&contents).map_err(|error| {
        format!(
            "{} is not a valid Tax Assistant configuration: {error}",
            path.display()
        )
    })?;
    validate_config(&config).map_err(|error| error.to_string())?;
    Ok(config)
}

fn write_config(path: &Path, config: &AppConfig) -> Result<(), String> {
    validate_config(config).map_err(|error| error.to_string())?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("could not create {}: {error}", parent.display()))?;
    }

    let serialized = serde_json::to_string_pretty(config)
        .map_err(|error| format!("could not serialize configuration: {error}"))?;
    let temporary = path.with_extension("conf.tmp");
    fs::write(&temporary, format!("{serialized}\n"))
        .map_err(|error| format!("could not write {}: {error}", temporary.display()))?;
    fs::rename(&temporary, path)
        .map_err(|error| format!("could not save {}: {error}", path.display()))
}

#[tauri::command]
fn load_config(app: AppHandle) -> Result<ConfigEnvelope, String> {
    let portable = portable_config_path()?;
    if portable.exists() {
        return Ok(ConfigEnvelope {
            config: parse_config(&portable)?,
            source: "Portable configuration".to_owned(),
            path: Some(portable.display().to_string()),
            portable: true,
        });
    }

    let user = user_config_path(&app)?;
    if user.exists() {
        return Ok(ConfigEnvelope {
            config: parse_config(&user)?,
            source: "Saved configuration".to_owned(),
            path: Some(user.display().to_string()),
            portable: false,
        });
    }

    Ok(ConfigEnvelope {
        config: default_config(),
        source: "Built-in defaults".to_owned(),
        path: None,
        portable: false,
    })
}

#[tauri::command]
fn save_config(app: AppHandle, config: AppConfig) -> Result<ConfigEnvelope, String> {
    let portable = portable_config_path()?;
    let (path, is_portable) = if portable.exists() {
        (portable, true)
    } else {
        (user_config_path(&app)?, false)
    };
    write_config(&path, &config)?;

    Ok(ConfigEnvelope {
        config,
        source: if is_portable {
            "Portable configuration".to_owned()
        } else {
            "Saved configuration".to_owned()
        },
        path: Some(path.display().to_string()),
        portable: is_portable,
    })
}

#[tauri::command]
fn read_config_file(path: String) -> Result<AppConfig, String> {
    parse_config(Path::new(&path))
}

#[tauri::command]
fn write_config_file(path: String, config: AppConfig) -> Result<(), String> {
    write_config(Path::new(&path), &config)
}

#[tauri::command]
fn get_default_config() -> AppConfig {
    default_config()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            import_csv,
            reanalyze_transactions,
            load_config,
            save_config,
            read_config_file,
            write_config_file,
            get_default_config
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Tax Assistant");
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    use tax_assistant_core::default_config;

    use super::{parse_config, write_config};

    fn temporary_config_path(label: &str) -> std::path::PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should follow the Unix epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("tax-assistant-{label}-{unique}.conf"))
    }

    #[test]
    fn configuration_round_trips_as_pretty_json() {
        let path = temporary_config_path("round-trip");
        let expected = default_config();

        write_config(&path, &expected).expect("configuration should save");
        let contents = fs::read_to_string(&path).expect("saved configuration should be readable");
        let actual = parse_config(&path).expect("saved configuration should parse");

        assert_eq!(actual, expected);
        assert!(contents.ends_with('\n'));
        assert!(contents.contains("\"schemaVersion\": 1"));
        fs::remove_file(path).expect("temporary configuration should be removed");
    }

    #[test]
    fn malformed_configuration_is_rejected() {
        let path = temporary_config_path("invalid");
        fs::write(&path, "{\"schemaVersion\": 1}")
            .expect("invalid test configuration should be written");

        let error = parse_config(&path).expect_err("missing transaction types should fail");

        assert!(error.contains("not a valid Tax Assistant configuration"));
        fs::remove_file(path).expect("temporary configuration should be removed");
    }
}
