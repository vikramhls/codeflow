# CodeFlow CLI 🚀

I've successfully built and linked the new Command Line Interface for CodeFlow! You can now control your application directly from your terminal using the `codeflow` command.

## What's Included

The CLI is a Node.js TypeScript application located in the `cli/` directory. Here are the core commands available:

### 🔐 Authentication
Since your backend uses GitHub OAuth, the easiest way to authenticate the CLI is by providing it with your active session token (JWT) from the web application.

- `codeflow auth login <token>`: Logs you in and saves your token locally.
- `codeflow auth status`: Verifies your connection to the backend and displays your username.
- `codeflow auth logout`: Clears your saved token.

### 📦 Repositories
- `codeflow repos list`: Fetches a list of all your imported repositories and displays their IDs and visibility.
- `codeflow repos map <id>`: Fetches and displays the AI-generated "Repo Map" for a specific repository.

### 🎯 Issues
- `codeflow issues list`: Shows all active issues/bounties across the platform.
- `codeflow issues view <id>`: Displays the details and description of a specific issue.

## How to Try It Out

I have already installed the dependencies, built the TypeScript code, and globally linked the package on your system using `npm link`! 

You can try it out immediately by opening a new terminal and typing:
```bash
codeflow --help
```

To fully use it:
1. Make sure your FastAPI backend is running (`python -m uvicorn app.main:app`).
2. Grab your JWT token (you can find this in your browser's Local Storage or Cookies while logged into the frontend dashboard).
3. Run `codeflow auth login YOUR_TOKEN`.
4. Try running `codeflow repos list`!
