import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CONFIG_FILE = path.join(os.homedir(), '.codeski-cli.json');

interface Config {
  token?: string;
  apiUrl?: string;
}

function readConfig(): Config {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    // Ignore read errors
  }
  return {};
}

function writeConfig(config: Config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export function getToken(): string | undefined {
  return readConfig().token;
}

export function setToken(token: string) {
  const config = readConfig();
  config.token = token;
  writeConfig(config);
}

export function clearToken() {
  const config = readConfig();
  delete config.token;
  writeConfig(config);
}

export function getApiUrl(): string {
  return readConfig().apiUrl || 'http://localhost:8000';
}

export function setApiUrl(url: string) {
  const config = readConfig();
  config.apiUrl = url;
  writeConfig(config);
}
