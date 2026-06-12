import { Command } from 'commander';
import chalk from 'chalk';
import { setToken, clearToken, getToken } from '../config';
import api from '../api';
import * as http from 'http';
import { exec } from 'child_process';
import * as os from 'os';

function openUrl(url: string) {
  const platform = os.platform();
  if (platform === 'win32') {
    exec(`start "" "${url}"`);
  } else if (platform === 'darwin') {
    exec(`open "${url}"`);
  } else {
    exec(`xdg-open "${url}"`);
  }
}

export function registerAuthCommands(program: Command) {
  const authCmd = program.command('auth').description('Manage authentication');

  authCmd
    .command('login')
    .description('Login to CodeSki via your browser')
    .action(async () => {
      console.log(chalk.blue('Opening browser to authenticate...'));
      
      const server = http.createServer((req, res) => {
        // Set CORS headers so the frontend can send the POST request
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }

        if (req.method === 'POST' && req.url === '/callback') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          req.on('end', async () => {
            try {
              const data = JSON.parse(body);
              if (data.token) {
                setToken(data.token);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
                
                // Verify the token
                try {
                  const apiRes = await api.get('/auth/me');
                  console.log(chalk.green(`\nSuccessfully logged in as ${chalk.bold(apiRes.data.username)}!`));
                } catch (e) {
                  console.log(chalk.yellow('\nToken received, but failed to verify with the backend.'));
                }
                
                // Shut down the local server
                server.close();
                process.exit(0);
              } else {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'No token provided' }));
              }
            } catch (err) {
              res.writeHead(400);
              res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
          });
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });

      server.listen(3456, () => {
        const loginUrl = 'http://localhost:5173/cli-login';
        console.log(chalk.dim(`Listening on http://localhost:3456...`));
        console.log(chalk.dim(`If your browser doesn't open automatically, navigate to: ${loginUrl}`));
        openUrl(loginUrl);
      });
    });

  authCmd
    .command('logout')
    .description('Clear your local authentication token')
    .action(() => {
      clearToken();
      console.log(chalk.green('Logged out successfully.'));
    });

  authCmd
    .command('status')
    .description('Check authentication status')
    .action(async () => {
      const token = getToken();
      if (!token) {
        console.log(chalk.yellow('You are not logged in. Use "codeski auth login".'));
        return;
      }
      try {
        const res = await api.get('/auth/me');
        console.log(chalk.green(`Logged in as: ${chalk.bold(res.data.username)} (${res.data.email || 'No email'})`));
      } catch (e) {
        console.log(chalk.red('Stored token is invalid or backend is unreachable.'));
      }
    });
}
