<<<<<<< HEAD
# Crypto Terminal

A Bloomberg-style terminal interface displaying the top 100 Binance perpetual futures pairs by volume, with daily, weekly, and monthly returns.

## Features

- **Top 100 Pairs**: Displays the top 100 Binance perpetual futures pairs sorted by 24h volume
- **30-Day Data**: Fetches 30 days of historical data for accurate return calculations
- **Return Metrics**: Shows daily, weekly, and monthly returns for each pair
- **Real-time Updates**: Auto-refreshes every 30 seconds
- **Terminal Aesthetic**: Dark theme with Bloomberg terminal-inspired design

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Data Source

This application uses the Binance Futures API:
- Ticker data: `https://fapi.binance.com/fapi/v1/ticker/24hr`
- Historical klines: `https://fapi.binance.com/fapi/v1/klines`

## Return Calculations

- **Daily Return**: Percentage change from 1 day ago
- **Weekly Return**: Percentage change from 7 days ago
- **Monthly Return**: Percentage change from 30 days ago (or earliest available data)

Returns are color-coded:
- Green: Positive returns
- Red: Negative returns

## Deployment to Vercel

This project is ready to deploy on Vercel. Follow these steps:

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Push your code to GitHub**
   - Create a new repository on GitHub
   - Push your code:
     ```bash
     git init
     git add .
     git commit -m "Initial commit"
     git remote add origin <your-github-repo-url>
     git push -u origin main
     ```

2. **Deploy on Vercel**
   - Go to [vercel.com](https://vercel.com) and sign in
   - Click "Add New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Next.js settings
   - Click "Deploy"

3. **Your app will be live!**
   - Vercel will provide you with a deployment URL
   - Future pushes to your main branch will automatically deploy

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel
   ```

3. **Follow the prompts**:
   - Login to your Vercel account
   - Link to an existing project or create a new one
   - Confirm the settings (Vercel auto-detects Next.js)

4. **For production deployment**:
   ```bash
   vercel --prod
   ```

### Important Notes

- **WebSocket Connections**: The app uses client-side WebSocket connections to Binance, which work perfectly on Vercel
- **API Routes**: Your API routes in `pages/api/` will be automatically deployed as serverless functions
- **Build Settings**: Vercel automatically detects Next.js and uses the correct build settings
- **Environment Variables**: If you need any environment variables, add them in the Vercel dashboard under Project Settings → Environment Variables

### Troubleshooting

- If you encounter build errors, make sure all dependencies are listed in `package.json`
- API rate limits from Binance are handled gracefully with retry logic
- The app is optimized for Vercel's serverless architecture

=======
# Crypto Terminal

A Bloomberg-style terminal interface displaying the top 100 Binance perpetual futures pairs by volume, with daily, weekly, and monthly returns.

## Features

- **Top 100 Pairs**: Displays the top 100 Binance perpetual futures pairs sorted by 24h volume
- **30-Day Data**: Fetches 30 days of historical data for accurate return calculations
- **Return Metrics**: Shows daily, weekly, and monthly returns for each pair
- **Real-time Updates**: Auto-refreshes every 30 seconds
- **Terminal Aesthetic**: Dark theme with Bloomberg terminal-inspired design

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Data Source

This application uses the Binance Futures API:
- Ticker data: `https://fapi.binance.com/fapi/v1/ticker/24hr`
- Historical klines: `https://fapi.binance.com/fapi/v1/klines`

## Return Calculations

- **Daily Return**: Percentage change from 1 day ago
- **Weekly Return**: Percentage change from 7 days ago
- **Monthly Return**: Percentage change from 30 days ago (or earliest available data)

Returns are color-coded:
- Green: Positive returns
- Red: Negative returns

## Deployment to Vercel

This project is ready to deploy on Vercel. Follow these steps:

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Push your code to GitHub**
   - Create a new repository on GitHub
   - Push your code:
     ```bash
     git init
     git add .
     git commit -m "Initial commit"
     git remote add origin <your-github-repo-url>
     git push -u origin main
     ```

2. **Deploy on Vercel**
   - Go to [vercel.com](https://vercel.com) and sign in
   - Click "Add New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Next.js settings
   - Click "Deploy"

3. **Your app will be live!**
   - Vercel will provide you with a deployment URL
   - Future pushes to your main branch will automatically deploy

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel
   ```

3. **Follow the prompts**:
   - Login to your Vercel account
   - Link to an existing project or create a new one
   - Confirm the settings (Vercel auto-detects Next.js)

4. **For production deployment**:
   ```bash
   vercel --prod
   ```

### Important Notes

- **WebSocket Connections**: The app uses client-side WebSocket connections to Binance, which work perfectly on Vercel
- **API Routes**: Your API routes in `pages/api/` will be automatically deployed as serverless functions
- **Build Settings**: Vercel automatically detects Next.js and uses the correct build settings
- **Environment Variables**: If you need any environment variables, add them in the Vercel dashboard under Project Settings → Environment Variables

### Troubleshooting

- If you encounter build errors, make sure all dependencies are listed in `package.json`
- API rate limits from Binance are handled gracefully with retry logic
- The app is optimized for Vercel's serverless architecture

>>>>>>> 5ad9ba79b4c6621384a49d222b40cfb71747d02e
