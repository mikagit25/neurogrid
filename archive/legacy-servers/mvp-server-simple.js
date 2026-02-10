#!/usr/bin/env node

/**
 * NeuroGrid MVP Simple Server
 * Just serves static HTML files from deploy/ directory
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

// Basic middleware
app.use(express.static(__dirname));

// Route handlers for all MVP pages
app.get('/', (req, res) => {
  const landingPath = path.join(__dirname, 'deploy', 'landing-page.html');
  if (fs.existsSync(landingPath)) {
    res.sendFile(landingPath);
  } else {
    res.status(404).send('Landing page not found');
  }
});

app.get('/demo', (req, res) => {
  const demoPath = path.join(__dirname, 'deploy', 'demo-setup.html');
  if (fs.existsSync(demoPath)) {
    res.sendFile(demoPath);
  } else {
    res.redirect('/');
  }
});

app.get('/api/docs', (req, res) => {
  const apiDocsPath = path.join(__dirname, 'deploy', 'api-docs.html');
  if (fs.existsSync(apiDocsPath)) {
    res.sendFile(apiDocsPath);
  } else {
    res.redirect('/');
  }
});

app.get('/technical-docs', (req, res) => {
  const techDocsPath = path.join(__dirname, 'deploy', 'technical-docs.html');
  if (fs.existsSync(techDocsPath)) {
    res.sendFile(techDocsPath);
  } else {
    res.redirect('/');
  }
});

app.get('/investors', (req, res) => {
  const investorsPath = path.join(__dirname, 'deploy', 'investors.html');
  if (fs.existsSync(investorsPath)) {
    res.sendFile(investorsPath);
  } else {
    res.redirect('/');
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'NeuroGrid MVP Simple',
    timestamp: new Date().toISOString(),
    version: '1.0.0-simple'
  });
});

// Start server - bind to all interfaces (IPv4 and IPv6)
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 NeuroGrid MVP Simple Server started!`);
  console.log(`📍 Server running on: http://0.0.0.0:${PORT}`);
  console.log(`🌐 All interfaces: IPv4 and IPv6`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 Available routes:`);
  console.log(`   / - Landing page`);
  console.log(`   /demo - Demo page`);
  console.log(`   /investors - Investors page`);
  console.log(`   /api/docs - API documentation`);
  console.log(`   /technical-docs - Technical documentation`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

module.exports = app;