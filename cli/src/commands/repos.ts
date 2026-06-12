import { Command } from 'commander';
import chalk from 'chalk';
import api from '../api';

export function registerReposCommands(program: Command) {
  const reposCmd = program.command('repos').description('Manage repositories');

  reposCmd
    .command('list')
    .description('List your imported repositories')
    .action(async () => {
      try {
        const res = await api.get('/repos/my');
        const repos = res.data.repos || res.data;
        if (repos.length === 0) {
          console.log(chalk.yellow('No repositories found.'));
          return;
        }
        console.log(chalk.bold('Your Repositories:'));
        repos.forEach((repo: any) => {
          console.log(`- ${chalk.blue(repo.full_name)} (ID: ${repo.id})`);
          console.log(`  Description: ${repo.description || 'N/A'}`);
          console.log(`  Visibility: ${repo.visibility}`);
        });
      } catch (e: any) {
        console.error(chalk.red('Failed to fetch repositories:'), e.response?.data?.detail || e.message);
      }
    });

  reposCmd
    .command('map')
    .argument('<id>', 'Repository ID')
    .description('Get the map for a specific repository')
    .action(async (id) => {
      try {
        const res = await api.get(`/repos/${id}/map`);
        console.log(chalk.bold(`\nRepo Map for ${id}:\n`));
        console.log(chalk.green(res.data.map || 'No map available.'));
      } catch (e: any) {
        console.error(chalk.red('Failed to fetch repo map:'), e.response?.data?.detail || e.message);
      }
    });
}
