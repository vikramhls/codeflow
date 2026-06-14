#!/usr/bin/env node
import { Command } from 'commander';
import { registerAuthCommands } from './commands/auth';
import { registerReposCommands } from './commands/repos';
import { registerIssuesCommands } from './commands/issues';
import { registerAskCommands } from './commands/ask';
import chalk from 'chalk';

const program = new Command();

program
  .name('codeski')
  .description('CodeSki Command Line Interface')
  .version('1.0.0');

// Register all commands
registerAuthCommands(program);
registerReposCommands(program);
registerIssuesCommands(program);
registerAskCommands(program);

program.on('command:*', () => {
  console.error(chalk.red('Invalid command: %s\nSee --help for a list of available commands.'), program.args.join(' '));
  process.exit(1);
});

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
