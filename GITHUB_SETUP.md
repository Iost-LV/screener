# How to Push to GitHub

**Your Repository**: https://github.com/Iost-LV/screener

Follow these steps to push your code to your existing GitHub repository:

## Step 1: Install Git (if not already installed)

1. **Download Git for Windows**: Go to https://git-scm.com/download/win
2. **Install Git**: Run the installer with default settings
3. **Restart your terminal/PowerShell** after installation

## Step 2: Configure Git (first time only)

Open PowerShell or Git Bash and run:

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

## Step 3: Create a GitHub Repository

1. Go to [github.com](https://github.com) and sign in
2. Click the **"+"** icon in the top right → **"New repository"**
3. Enter a repository name (e.g., `crypto-terminal`)
4. Choose **Public** or **Private**
5. **DO NOT** initialize with README, .gitignore, or license (we already have these)
6. Click **"Create repository"**

## Step 4: Push Your Code

Open PowerShell in your project directory and run these commands:

### Initialize Git (if not already done)
```bash
git init
```

### Add all files
```bash
git add .
```

### Create your first commit
```bash
git commit -m "Initial commit"
```

### Add your GitHub repository as remote
Use your existing repository URL:

```bash
git remote add origin https://github.com/Iost-LV/screener.git
```

**Note**: If you get an error saying "remote origin already exists", remove it first:
```bash
git remote remove origin
git remote add origin https://github.com/Iost-LV/screener.git
```

### Push to GitHub
```bash
git branch -M main
git push -u origin main
```

**Note**: You'll be prompted for your GitHub username and password. If you have 2FA enabled, you'll need to use a Personal Access Token instead of your password.

## Step 5: Create a Personal Access Token (if needed)

If you have 2FA enabled or get authentication errors:

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click **"Generate new token (classic)"**
3. Give it a name (e.g., "Vercel Deployment")
4. Select scopes: Check **"repo"** (this gives full access to repositories)
5. Click **"Generate token"**
6. **Copy the token** (you won't see it again!)
7. When pushing, use your GitHub username and the token as the password

## Alternative: Using GitHub Desktop

If you prefer a GUI:

1. Download [GitHub Desktop](https://desktop.github.com/)
2. Sign in with your GitHub account
3. Click **"File" → "Add Local Repository"**
4. Select your project folder
5. Click **"Publish repository"** in GitHub Desktop
6. Choose your repository name and click **"Publish Repository"**

## Troubleshooting

### "git is not recognized"
- Make sure Git is installed and you've restarted your terminal
- Try using Git Bash instead of PowerShell

### Authentication errors
- Use a Personal Access Token instead of your password
- Or use SSH keys (more advanced)

### "remote origin already exists"
- Remove it first: `git remote remove origin`
- Then add it again with the correct URL

## Next Steps

Once your code is on GitHub, you can:
1. Deploy to Vercel by importing the GitHub repository
2. Share your code with others
3. Collaborate with team members

