import { Command } from 'commander';
import chalk from 'chalk';
import api from '../api';

export function registerIssuesCommands(program: Command) {
  const issuesCmd = program.command('issues').description('Manage issues and bounties');

  issuesCmd
    .command('list')
    .description('List all active issues')
    .action(async () => {
      try {
        const res = await api.get('/issues');
        const issues = res.data.issues || [];
        if (issues.length === 0) {
          console.log(chalk.yellow('No issues found.'));
          return;
        }
        console.log(chalk.bold('Active Issues:'));
        issues.forEach((issue: any) => {
          console.log(`\n- ${chalk.blue(issue.title)} (ID: ${issue.id})`);
          console.log(`  Bounty: ${issue.bounty_points} points`);
          console.log(`  Status: ${issue.status}`);
          console.log(`  Repo: ${issue.repo_name}`);
        });
      } catch (e: any) {
        console.error(chalk.red('Failed to fetch issues:'), e.response?.data?.detail || e.message);
      }
    });

  issuesCmd
    .command('view')
    .argument('<id>', 'Issue ID')
    .description('View details of a specific issue')
    .action(async (id) => {
      try {
        const res = await api.get(`/issues/${id}`);
        const issue = res.data;
        console.log(chalk.bold(`\nIssue: ${issue.title} (ID: ${issue.id})`));
        console.log(`Status: ${chalk.cyan(issue.status)}`);
        console.log(`Bounty: ${chalk.green(issue.bounty_points + ' points')}`);
        console.log(`\nDescription:\n${issue.description}\n`);
      } catch (e: any) {
        console.error(chalk.red('Failed to fetch issue:'), e.response?.data?.detail || e.message);
      }
    });
}
