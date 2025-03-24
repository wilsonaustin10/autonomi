# Contributing to Autonomi

## Git Workflow

### Setting Up Your Development Environment

1. Clone the repository:
   ```
   git clone https://github.com/golden-children/autonomi.git
   cd autonomi
   ```

2. Create your feature branch:
   ```
   git checkout -b your-feature-name
   ```
   
   Note: Use descriptive branch names that reflect the feature or fix you're working on.

### Making Changes

1. Make your changes to the codebase
2. Stage your changes:
   ```
   git add .
   ```
3. Commit your changes with a descriptive message:
   ```
   git commit -m "Add detailed description of your changes"
   ```

### Pushing Changes

#### If you have direct write access:
```
git push -u origin your-feature-name
```

#### If you don't have write access:
1. Fork the repository on GitHub
2. Add your fork as a remote:
   ```
   git remote add fork https://github.com/YOUR_USERNAME/autonomi.git
   ```
3. Push to your fork:
   ```
   git push -u fork your-feature-name
   ```
4. Create a pull request from your fork to the main repository

### Creating Pull Requests

1. Go to the original repository on GitHub
2. Click "New Pull Request"
3. Select your branch
4. Fill in the PR template with details about your changes
5. Submit the pull request for review

### Keeping Your Branch Updated

To update your feature branch with the latest changes from the main branch:

```
git checkout main
git pull origin main
git checkout your-feature-name
git merge main
```

## Code Style and Standards

[Add your team's code style guidelines here]

## Testing Guidelines

[Add your team's testing requirements here] 