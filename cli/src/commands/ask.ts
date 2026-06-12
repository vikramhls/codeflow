import { Command } from 'commander';
import chalk from 'chalk';
import axios from 'axios';
import { loadToken } from '../utils/auth';
import { API_URL } from '../config';
import ora from 'ora';

export function registerAskCommands(program: Command) {
  program
    .command('ask <repoId> <query>')
    .description('Ask a question about the repository codebase using AI')
    .action(async (repoId: string, query: string) => {
      const token = loadToken();
      if (!token) {
        console.log(chalk.red('You must be logged in to use this command.'));
        process.exit(1);
      }

      const spinner = ora('Analyzing codebase...').start();

      try {
        const response = await axios.post(
          `${API_URL}/knowledge/repos/${repoId}/ask`,
          { query },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        spinner.succeed('Analysis complete');
        console.log('\n' + chalk.cyan.bold('Answer:'));
        console.log(response.data.answer);

        if (response.data.snippets && response.data.snippets.length > 0) {
          console.log('\n' + chalk.yellow.bold('References:'));
          response.data.snippets.forEach((snip: any) => {
            console.log(chalk.gray(`- ${snip.path}`));
          });
        }
      } catch (error: any) {
        spinner.fail('Failed to get answer');
        if (error.response?.status === 404) {
          console.log(chalk.red('Repository not found.'));
        } else if (error.response?.data?.detail) {
          console.log(chalk.red(`Error: ${error.response.data.detail}`));
        } else {
          console.log(chalk.red(`Error: ${error.message}`));
        }
      }
    });
}
