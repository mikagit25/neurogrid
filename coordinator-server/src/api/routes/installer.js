const express = require('express');
const { body, validationResult } = require('express-validator');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const logger = require('../../utils/logger');

const router = express.Router();

/**
 * Installer Generator Service
 * Creates personalized node installers for different platforms
 */

/**
 * @route POST /api/nodes/generate-installer
 * @desc Generate personalized node installer
 * @access Public
 */
router.post('/generate-installer', [
  body('platform').isIn(['windows', 'macos', 'linux']).withMessage('Invalid platform'),
  body('nodeId').isString().notEmpty().withMessage('Node ID is required'),
  body('hardware').isObject().withMessage('Hardware configuration is required'),
  body('settings').isObject().withMessage('Node settings are required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { platform, nodeId, hardware, settings } = req.body;
    
    logger.info('Generating installer', {
      platform,
      nodeId,
      hardware: hardware,
      settings: settings.nodeName
    });

    // Generate unique installation token
    const installToken = crypto.randomBytes(32).toString('hex');
    
    // Create installer configuration
    const installerConfig = {
      nodeId,
      installToken,
      platform,
      hardware,
      settings,
      coordinatorUrl: process.env.COORDINATOR_URL || 'http://localhost:3001',
      version: '1.0.0',
      createdAt: new Date().toISOString()
    };

    // Generate installer based on platform
    let installerBuffer;
    let contentType;
    let filename;

    switch (platform) {
      case 'windows':
        installerBuffer = await generateWindowsInstaller(installerConfig);
        contentType = 'application/octet-stream';
        filename = `neurogrid-node-${nodeId.slice(-8)}.exe`;
        break;
      case 'macos':
        installerBuffer = await generateMacOSInstaller(installerConfig);
        contentType = 'application/octet-stream';
        filename = `neurogrid-node-${nodeId.slice(-8)}.pkg`;
        break;
      case 'linux':
        installerBuffer = await generateLinuxInstaller(installerConfig);
        contentType = 'application/x-shellscript';
        filename = `neurogrid-node-${nodeId.slice(-8)}.sh`;
        break;
      default:
        throw new Error('Unsupported platform');
    }

    // Set response headers for file download
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', installerBuffer.length);

    // Send installer
    res.send(installerBuffer);

    logger.info('Installer generated successfully', {
      nodeId,
      platform,
      filename,
      size: installerBuffer.length
    });

  } catch (error) {
    logger.error('Error generating installer:', error);
    res.status(500).json({
      error: 'Failed to generate installer',
      message: error.message
    });
  }
});

/**
 * Generate Windows installer (.exe)
 */
async function generateWindowsInstaller(config) {
  const archive = archiver('zip');
  const chunks = [];

  archive.on('data', chunk => chunks.push(chunk));
  archive.on('error', err => { throw err; });

  // Create installation script
  const installScript = generateWindowsInstallScript(config);
  archive.append(installScript, { name: 'install.bat' });

  // Add node executable (placeholder - in production would be actual binary)
  const nodeExecutable = await generateNodeExecutable(config);
  archive.append(nodeExecutable, { name: 'neurogrid-node.exe' });

  // Add configuration file
  const configFile = JSON.stringify(config, null, 2);
  archive.append(configFile, { name: 'config.json' });

  // Add Windows service installer
  const serviceScript = generateWindowsServiceScript(config);
  archive.append(serviceScript, { name: 'install-service.bat' });

  // Add uninstaller
  const uninstallScript = generateWindowsUninstallScript(config);
  archive.append(uninstallScript, { name: 'uninstall.bat' });

  // Add README
  const readme = generateReadme(config);
  archive.append(readme, { name: 'README.txt' });

  await archive.finalize();
  return Buffer.concat(chunks);
}

/**
 * Generate macOS installer (.pkg structure)
 */
async function generateMacOSInstaller(config) {
  const archive = archiver('zip');
  const chunks = [];

  archive.on('data', chunk => chunks.push(chunk));
  archive.on('error', err => { throw err; });

  // Create installation script
  const installScript = generateMacOSInstallScript(config);
  archive.append(installScript, { name: 'install.sh' });

  // Add node executable
  const nodeExecutable = await generateNodeExecutable(config);
  archive.append(nodeExecutable, { name: 'neurogrid-node' });

  // Add configuration file
  const configFile = JSON.stringify(config, null, 2);
  archive.append(configFile, { name: 'config.json' });

  // Add LaunchDaemon plist
  const launchDaemon = generateMacOSLaunchDaemon(config);
  archive.append(launchDaemon, { name: 'com.neurogrid.node.plist' });

  // Add uninstaller
  const uninstallScript = generateMacOSUninstallScript(config);
  archive.append(uninstallScript, { name: 'uninstall.sh' });

  // Add README
  const readme = generateReadme(config);
  archive.append(readme, { name: 'README.txt' });

  await archive.finalize();
  return Buffer.concat(chunks);
}

/**
 * Generate Linux installer (.sh)
 */
async function generateLinuxInstaller(config) {
  const installScript = generateLinuxInstallScript(config);
  return Buffer.from(installScript, 'utf8');
}

/**
 * Generate Windows installation script
 */
function generateWindowsInstallScript(config) {
  return `@echo off
echo NeuroGrid Node Installer v${config.version}
echo Installing Node: ${config.settings.nodeName}
echo Platform: Windows
echo.

REM Create installation directory
set INSTALL_DIR=%ProgramFiles%\\NeuroGrid\\Node
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

REM Copy files
copy neurogrid-node.exe "%INSTALL_DIR%\\"
copy config.json "%INSTALL_DIR%\\"

REM Install Windows service
call install-service.bat

REM Add to PATH
setx PATH "%PATH%;%INSTALL_DIR%" /M

REM Start service
net start NeuroGridNode

echo.
echo Installation completed successfully!
echo Node ID: ${config.nodeId}
echo Your node will automatically connect to the NeuroGrid network.
echo.
pause`;
}

/**
 * Generate Windows service installation script
 */
function generateWindowsServiceScript(config) {
  return `@echo off
echo Installing NeuroGrid Node as Windows Service...

sc create NeuroGridNode binPath= "%ProgramFiles%\\NeuroGrid\\Node\\neurogrid-node.exe --service" ^
    DisplayName= "NeuroGrid Node" ^
    Description= "NeuroGrid distributed computing node" ^
    start= auto

if %errorlevel% == 0 (
    echo Service installed successfully!
) else (
    echo Failed to install service. Please run as administrator.
)`;
}

/**
 * Generate Windows uninstall script
 */
function generateWindowsUninstallScript(config) {
  return `@echo off
echo Uninstalling NeuroGrid Node...

REM Stop service
net stop NeuroGridNode

REM Remove service
sc delete NeuroGridNode

REM Remove files
rmdir /s /q "%ProgramFiles%\\NeuroGrid"

echo Uninstallation completed.
pause`;
}

/**
 * Generate macOS installation script
 */
function generateMacOSInstallScript(config) {
  return `#!/bin/bash
echo "NeuroGrid Node Installer v${config.version}"
echo "Installing Node: ${config.settings.nodeName}"
echo "Platform: macOS"
echo

# Check for admin privileges
if [[ $EUID -eq 0 ]]; then
   echo "Please do not run this script as root/sudo"
   exit 1
fi

# Create installation directory
INSTALL_DIR="/usr/local/bin"
CONFIG_DIR="$HOME/.neurogrid"

echo "Creating directories..."
mkdir -p "$CONFIG_DIR"

# Copy executable
echo "Installing NeuroGrid Node..."
sudo cp neurogrid-node "$INSTALL_DIR/"
sudo chmod +x "$INSTALL_DIR/neurogrid-node"

# Copy configuration
cp config.json "$CONFIG_DIR/"

# Install LaunchDaemon
echo "Installing system service..."
sudo cp com.neurogrid.node.plist /Library/LaunchDaemons/
sudo chown root:wheel /Library/LaunchDaemons/com.neurogrid.node.plist
sudo chmod 644 /Library/LaunchDaemons/com.neurogrid.node.plist

# Load and start service
sudo launchctl load /Library/LaunchDaemons/com.neurogrid.node.plist
sudo launchctl start com.neurogrid.node

echo
echo "Installation completed successfully!"
echo "Node ID: ${config.nodeId}"
echo "Your node will automatically connect to the NeuroGrid network."
echo
echo "To check status: sudo launchctl list | grep neurogrid"
echo "To stop: sudo launchctl stop com.neurogrid.node"
echo "To uninstall: run ./uninstall.sh"`;
}

/**
 * Generate macOS LaunchDaemon plist
 */
function generateMacOSLaunchDaemon(config) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.neurogrid.node</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/neurogrid-node</string>
        <string>--config</string>
        <string>/Users/%USER%/.neurogrid/config.json</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/neurogrid-node.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/neurogrid-node-error.log</string>
</dict>
</plist>`;
}

/**
 * Generate macOS uninstall script
 */
function generateMacOSUninstallScript(config) {
  return `#!/bin/bash
echo "Uninstalling NeuroGrid Node..."

# Stop and unload service
sudo launchctl stop com.neurogrid.node
sudo launchctl unload /Library/LaunchDaemons/com.neurogrid.node.plist

# Remove files
sudo rm -f /Library/LaunchDaemons/com.neurogrid.node.plist
sudo rm -f /usr/local/bin/neurogrid-node
rm -rf ~/.neurogrid

echo "Uninstallation completed."`;
}

/**
 * Generate Linux installation script
 */
function generateLinuxInstallScript(config) {
  return `#!/bin/bash
# NeuroGrid Node Installer v${config.version}
# Auto-generated installer for Node: ${config.settings.nodeName}
# Platform: Linux

set -e

echo "NeuroGrid Node Installer v${config.version}"
echo "Installing Node: ${config.settings.nodeName}"
echo "Platform: Linux"
echo

# Check for root privileges
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root (use sudo)"
   exit 1
fi

# Detect distribution
if [ -f /etc/os-release ]; then
    . /etc/os-release
    DISTRO=$ID
else
    echo "Cannot detect Linux distribution"
    exit 1
fi

echo "Detected distribution: $DISTRO"

# Install dependencies
echo "Installing dependencies..."
case $DISTRO in
    ubuntu|debian)
        apt-get update
        apt-get install -y curl wget python3 python3-pip
        ;;
    centos|rhel|fedora)
        if command -v dnf &> /dev/null; then
            dnf install -y curl wget python3 python3-pip
        else
            yum install -y curl wget python3 python3-pip
        fi
        ;;
    *)
        echo "Unsupported distribution: $DISTRO"
        echo "Please install curl, wget, python3, and python3-pip manually"
        ;;
esac

# Create user and directories
echo "Creating system user and directories..."
useradd -r -s /bin/false neurogrid || true
mkdir -p /opt/neurogrid
mkdir -p /etc/neurogrid
mkdir -p /var/log/neurogrid

# Create node executable (embedded base64)
echo "Installing NeuroGrid Node executable..."
cat > /opt/neurogrid/neurogrid-node << 'EMBEDDED_EXECUTABLE'
$(echo '${Buffer.from(generateNodeExecutable(config)).toString('base64')}' | base64 -d)
EMBEDDED_EXECUTABLE

chmod +x /opt/neurogrid/neurogrid-node

# Create configuration file
echo "Creating configuration..."
cat > /etc/neurogrid/config.json << 'EOF'
${JSON.stringify(config, null, 2)}
EOF

# Create systemd service
echo "Installing systemd service..."
cat > /etc/systemd/system/neurogrid-node.service << 'EOF'
[Unit]
Description=NeuroGrid Node
After=network.target

[Service]
Type=simple
User=neurogrid
Group=neurogrid
ExecStart=/opt/neurogrid/neurogrid-node --config /etc/neurogrid/config.json
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Set permissions
chown -R neurogrid:neurogrid /opt/neurogrid
chown -R neurogrid:neurogrid /etc/neurogrid
chown -R neurogrid:neurogrid /var/log/neurogrid

# Enable and start service
systemctl daemon-reload
systemctl enable neurogrid-node
systemctl start neurogrid-node

echo
echo "Installation completed successfully!"
echo "Node ID: ${config.nodeId}"
echo "Your node will automatically connect to the NeuroGrid network."
echo
echo "To check status: systemctl status neurogrid-node"
echo "To view logs: journalctl -u neurogrid-node -f"
echo "To stop: systemctl stop neurogrid-node"
echo "To uninstall: systemctl stop neurogrid-node && systemctl disable neurogrid-node && rm -rf /opt/neurogrid /etc/neurogrid"
echo

# Verify installation
sleep 3
if systemctl is-active --quiet neurogrid-node; then
    echo "✅ NeuroGrid Node is running successfully!"
else
    echo "❌ NeuroGrid Node failed to start. Check logs with: journalctl -u neurogrid-node"
fi`;
}

/**
 * Generate node executable (placeholder - in production would be actual compiled binary)
 */
async function generateNodeExecutable(config) {
  // In production, this would return the actual compiled node client binary
  // For now, we'll create a simple Node.js script
  const nodeScript = `#!/usr/bin/env node
/**
 * NeuroGrid Node Client v${config.version}
 * Generated for Node: ${config.settings.nodeName}
 * Node ID: ${config.nodeId}
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

class NeuroGridNode {
  constructor(config) {
    this.config = config;
    this.isRunning = false;
    this.heartbeatInterval = null;
    this.taskQueue = [];
    this.currentTasks = new Map();
  }

  async start() {
    console.log('NeuroGrid Node starting...');
    console.log('Node ID:', this.config.nodeId);
    console.log('Node Name:', this.config.settings.nodeName);
    console.log('Coordinator URL:', this.config.coordinatorUrl);
    
    try {
      await this.registerWithCoordinator();
      this.startHeartbeat();
      this.isRunning = true;
      console.log('✅ NeuroGrid Node is running successfully!');
      
      // Keep process alive
      process.on('SIGINT', () => this.stop());
      process.on('SIGTERM', () => this.stop());
      
    } catch (error) {
      console.error('❌ Failed to start NeuroGrid Node:', error.message);
      process.exit(1);
    }
  }

  async registerWithCoordinator() {
    const registrationData = {
      node_id: this.config.nodeId,
      node_token: this.config.installToken,
      system_info: {
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        cpus: os.cpus().length,
        memory: Math.round(os.totalmem() / 1024 / 1024 / 1024) // GB
      },
      supported_models: this.config.settings.supportedModels,
      max_vram_gb: this.config.hardware.vramGB,
      max_cpu_cores: this.config.hardware.cpuCores,
      version: this.config.version,
      capabilities: {
        maxConcurrentTasks: this.config.hardware.maxTasks,
        hourlyCost: this.config.settings.hourlyCost,
        region: this.config.settings.nodeRegion
      }
    };

    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(registrationData);
      const url = new URL('/api/nodes/register', this.config.coordinatorUrl);
      
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const client = url.protocol === 'https:' ? https : http;
      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 201) {
            console.log('✅ Successfully registered with coordinator');
            resolve(JSON.parse(data));
          } else {
            reject(new Error(\`Registration failed: \${res.statusCode} \${data}\`));
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.sendHeartbeat();
      } catch (error) {
        console.error('Heartbeat failed:', error.message);
      }
    }, 30000); // Every 30 seconds
  }

  async sendHeartbeat() {
    const heartbeatData = {
      timestamp: new Date().toISOString(),
      status: this.currentTasks.size > 0 ? 'busy' : 'active',
      current_task: this.currentTasks.size > 0 ? Array.from(this.currentTasks.keys())[0] : null,
      tasks_completed: 0, // Track this properly in production
      uptime: process.uptime(),
      metrics: {
        cpuUsage: os.loadavg()[0],
        memoryUsage: (os.totalmem() - os.freemem()) / os.totalmem() * 100,
        vramUsage: 0 // Would need GPU monitoring library
      }
    };

    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(heartbeatData);
      const url = new URL(\`/api/nodes/\${this.config.nodeId}/heartbeat\`, this.config.coordinatorUrl);
      
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const client = url.protocol === 'https:' ? https : http;
      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(\`Heartbeat failed: \${res.statusCode} \${data}\`));
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  stop() {
    console.log('NeuroGrid Node shutting down...');
    this.isRunning = false;
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    console.log('✅ NeuroGrid Node stopped gracefully');
    process.exit(0);
  }
}

// Load configuration and start node
const configPath = process.argv.includes('--config') 
  ? process.argv[process.argv.indexOf('--config') + 1]
  : path.join(__dirname, 'config.json');

try {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const node = new NeuroGridNode(config);
  node.start();
} catch (error) {
  console.error('Failed to load configuration:', error.message);
  process.exit(1);
}`;

  return Buffer.from(nodeScript, 'utf8');
}

/**
 * Generate README file
 */
function generateReadme(config) {
  return `NeuroGrid Node v${config.version}
========================

This is your personalized NeuroGrid Node installer.

Node Information:
- Node ID: ${config.nodeId}
- Node Name: ${config.settings.nodeName}
- Platform: ${config.platform}
- Region: ${config.settings.nodeRegion}
- Created: ${config.createdAt}

Hardware Configuration:
- CPU Cores: ${config.hardware.cpuCores}
- RAM: ${config.hardware.ramGB} GB
- VRAM: ${config.hardware.vramGB} GB
- Max Concurrent Tasks: ${config.hardware.maxTasks}

Supported Models:
${config.settings.supportedModels.map(model => '- ' + model).join('\n')}

Installation:
${config.platform === 'windows' ? 
  '1. Run install.bat as Administrator\n2. The node will be installed as a Windows service\n3. Service will start automatically' :
  config.platform === 'macos' ?
  '1. Run: chmod +x install.sh\n2. Run: ./install.sh\n3. The node will be installed as a LaunchDaemon' :
  '1. Run: chmod +x neurogrid-node-setup.sh\n2. Run: sudo ./neurogrid-node-setup.sh\n3. The node will be installed as a systemd service'
}

Support:
- Documentation: https://docs.neurogrid.io
- Support: support@neurogrid.io
- Community: https://discord.gg/neurogrid

© 2025 NeuroGrid. All rights reserved.`;
}

module.exports = router;