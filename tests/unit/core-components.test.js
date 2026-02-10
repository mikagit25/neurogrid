/**
 * Unit Tests for NeuroGrid Core Components
 * Tests basic functionality of core systems
 */

const fs = require('fs');
const path = require('path');

describe('NeuroGrid Core Components', () => {
    
    describe('Project Structure', () => {
        test('should have main entry point', () => {
            expect(fs.existsSync(path.join(__dirname, '../../index.js'))).toBe(true);
        });
        
        test('should have enhanced server', () => {
            expect(fs.existsSync(path.join(__dirname, '../../enhanced-server.js'))).toBe(true);
        });
        
        test('should have package.json with correct main entry', () => {
            const packageJson = require('../../package.json');
            expect(packageJson.main).toBe('index.js');
            expect(packageJson.scripts.start).toBe('node index.js smart-router');
        });
        
        test('should have proper documentation structure', () => {
            expect(fs.existsSync(path.join(__dirname, '../../DOCS_INDEX.md'))).toBe(true);
            expect(fs.existsSync(path.join(__dirname, '../../docs/development'))).toBe(true);
            expect(fs.existsSync(path.join(__dirname, '../../docs/deployment'))).toBe(true);
            expect(fs.existsSync(path.join(__dirname, '../../docs/architecture'))).toBe(true);
        });
    });
    
    describe('Configuration Files', () => {
        test('should have environment configuration', () => {
            expect(fs.existsSync(path.join(__dirname, '../../.env.example'))).toBe(true);
        });
        
        test('should have Docker configuration', () => {
            expect(fs.existsSync(path.join(__dirname, '../../Dockerfile'))).toBe(true);
            expect(fs.existsSync(path.join(__dirname, '../../docker-compose.yml'))).toBe(true);
        });
        
        test('should have CI/CD configuration', () => {
            expect(fs.existsSync(path.join(__dirname, '../../.github/workflows/ci-cd.yml'))).toBe(true);
        });
    });
    
    describe('Smart Model Router Components', () => {
        test('should contain Smart Model Router', () => {
            expect(fs.existsSync(path.join(__dirname, '../../src/SmartModelRouter.js'))).toBe(true);
        });
        
        test('should contain AI managers', () => {
            expect(fs.existsSync(path.join(__dirname, '../../src/ai/ModelManager.js'))).toBe(true);
            expect(fs.existsSync(path.join(__dirname, '../../src/ai/AICacheManager.js'))).toBe(true);
            expect(fs.existsSync(path.join(__dirname, '../../src/ai/AnalyticsManager.js'))).toBe(true);
        });
        
        test('should contain Phase 3 and Phase 4 components', () => {
            expect(fs.existsSync(path.join(__dirname, '../../src/phase3/Phase3Manager.js'))).toBe(true);
            expect(fs.existsSync(path.join(__dirname, '../../src/phase4/Phase4DeFiManager.js'))).toBe(true);
        });
    });
    
    describe('Archive Structure', () => {
        test('should have archived legacy servers', () => {
            expect(fs.existsSync(path.join(__dirname, '../../archive/legacy-servers'))).toBe(true);
        });
        
        test('should have archived old documentation', () => {
            expect(fs.existsSync(path.join(__dirname, '../../archive/old-docs'))).toBe(true);
        });
    });
    
    describe('Scripts Organization', () => {
        test('should have organized deploy scripts', () => {
            expect(fs.existsSync(path.join(__dirname, '../../scripts/deploy'))).toBe(true);
        });
        
        test('should have organized build scripts', () => {
            expect(fs.existsSync(path.join(__dirname, '../../scripts/build'))).toBe(true);
        });
        
        test('should have organized maintenance scripts', () => {
            expect(fs.existsSync(path.join(__dirname, '../../scripts/maintenance'))).toBe(true);
        });
    });
    
});