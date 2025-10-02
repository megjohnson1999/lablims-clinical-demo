#!/usr/bin/env node

/**
 * Comprehensive verification test suite runner
 * Runs all verification tests and generates a detailed report
 */

const fs = require('fs').promises;
const path = require('path');
const { runVerification } = require('./verify-migration');
const { runConcurrentLoadTests } = require('./load-test-concurrent-ids');
const { runEdgeCaseTests } = require('./test-edge-cases');
const { runIntegrationWorkflowTest } = require('./test-integration-workflow');

class VerificationTestRunner {
  constructor() {
    this.results = {
      startTime: new Date().toISOString(),
      endTime: null,
      totalDuration: null,
      overallStatus: 'running',
      testSuites: {},
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        passRate: 0
      },
      issues: [],
      recommendations: []
    };
    
    this.testSuites = [
      {
        name: 'Migration Verification',
        description: 'Verifies that migration preserved existing data and set correct counter values',
        runner: runVerification,
        priority: 'critical',
        timeout: 30000
      },
      {
        name: 'Concurrent Load Testing', 
        description: 'Tests ID generation under realistic concurrent load',
        runner: runConcurrentLoadTests,
        priority: 'critical',
        timeout: 120000
      },
      {
        name: 'Edge Case Testing',
        description: 'Tests various failure scenarios and edge conditions',
        runner: runEdgeCaseTests,
        priority: 'high',
        timeout: 60000
      },
      {
        name: 'Integration Workflow Testing',
        description: 'Tests complete create→store→export→import workflow',
        runner: runIntegrationWorkflowTest,
        priority: 'critical',
        timeout: 180000
      }
    ];
  }

  async runAllTests() {
    console.log('🚀 Starting Comprehensive Verification Test Suite');
    console.log('==================================================\n');
    
    console.log(`Running ${this.testSuites.length} test suites...\n`);

    for (const testSuite of this.testSuites) {
      await this.runTestSuite(testSuite);
    }

    this.results.endTime = new Date().toISOString();
    this.results.totalDuration = Date.parse(this.results.endTime) - Date.parse(this.results.startTime);
    this.calculateSummary();
    this.generateRecommendations();
    
    return this.generateFinalReport();
  }

  async runTestSuite(testSuite) {
    console.log(`\n📋 Running: ${testSuite.name}`);
    console.log(`   Description: ${testSuite.description}`);
    console.log(`   Priority: ${testSuite.priority.toUpperCase()}`);
    console.log('   ' + '='.repeat(60));

    const suiteResult = {
      name: testSuite.name,
      description: testSuite.description,
      priority: testSuite.priority,
      startTime: new Date().toISOString(),
      endTime: null,
      duration: null,
      status: 'running',
      passed: false,
      error: null,
      details: null
    };

    try {
      // Run the test with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Test suite timeout')), testSuite.timeout);
      });
      
      const testPromise = testSuite.runner();
      const result = await Promise.race([testPromise, timeoutPromise]);
      
      suiteResult.endTime = new Date().toISOString();
      suiteResult.duration = Date.parse(suiteResult.endTime) - Date.parse(suiteResult.startTime);
      suiteResult.status = 'completed';
      suiteResult.passed = result.passed;
      suiteResult.details = result;
      
      if (result.passed) {
        console.log(`   ✅ ${testSuite.name}: PASSED`);
      } else {
        console.log(`   ❌ ${testSuite.name}: FAILED`);
        if (result.issues && result.issues.length > 0) {
          console.log(`   Issues found:`);
          result.issues.forEach((issue, index) => {
            console.log(`     ${index + 1}. ${issue}`);
            this.results.issues.push(`${testSuite.name}: ${issue}`);
          });
        }
      }

    } catch (error) {
      suiteResult.endTime = new Date().toISOString();
      suiteResult.duration = Date.parse(suiteResult.endTime) - Date.parse(suiteResult.startTime);
      suiteResult.status = 'error';
      suiteResult.passed = false;
      suiteResult.error = error.message;
      
      console.log(`   💥 ${testSuite.name}: ERROR`);
      console.log(`   Error: ${error.message}`);
      
      this.results.issues.push(`${testSuite.name}: Test suite failed with error - ${error.message}`);
    }

    this.results.testSuites[testSuite.name] = suiteResult;
    console.log(`   Duration: ${(suiteResult.duration / 1000).toFixed(2)}s`);
  }

  calculateSummary() {
    const suites = Object.values(this.results.testSuites);
    this.results.summary.totalTests = suites.length;
    this.results.summary.passedTests = suites.filter(s => s.passed).length;
    this.results.summary.failedTests = suites.filter(s => !s.passed).length;
    this.results.summary.passRate = (this.results.summary.passedTests / this.results.summary.totalTests) * 100;
    
    // Determine overall status
    const criticalTests = suites.filter(s => s.priority === 'critical');
    const failedCritical = criticalTests.filter(s => !s.passed);
    
    if (failedCritical.length > 0) {
      this.results.overallStatus = 'critical_failure';
    } else if (this.results.summary.failedTests > 0) {
      this.results.overallStatus = 'partial_failure';
    } else {
      this.results.overallStatus = 'success';
    }
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Check critical failures
    const criticalFailures = Object.values(this.results.testSuites)
      .filter(s => s.priority === 'critical' && !s.passed);
    
    if (criticalFailures.length > 0) {
      recommendations.push({
        priority: 'critical',
        title: 'Critical Test Failures Must Be Resolved',
        description: 'The following critical tests failed and must be fixed before proceeding to Phase 1',
        actions: criticalFailures.map(f => `Fix issues in: ${f.name}`)
      });
    }
    
    // Check performance issues
    const slowTests = Object.values(this.results.testSuites)
      .filter(s => s.duration > 60000); // 1 minute
    
    if (slowTests.length > 0) {
      recommendations.push({
        priority: 'medium',
        title: 'Performance Optimization Needed',
        description: 'Some tests took longer than expected to complete',
        actions: [
          'Review database performance and indexing',
          'Consider optimizing concurrent operations',
          'Check network latency and connection pooling'
        ]
      });
    }
    
    // Check error patterns
    const errorPatterns = this.analyzeErrorPatterns();
    if (errorPatterns.length > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Common Error Patterns Detected',
        description: 'Multiple tests failed with similar issues',
        actions: errorPatterns
      });
    }
    
    // Success recommendations
    if (this.results.overallStatus === 'success') {
      recommendations.push({
        priority: 'info',
        title: 'Ready for Phase 1',
        description: 'All verification tests passed successfully',
        actions: [
          'Begin Phase 1 inventory feature development',
          'Set up monitoring for the auto-ID system in production',
          'Consider setting up automated regression testing',
          'Document the verification process for future use'
        ]
      });
    }
    
    this.results.recommendations = recommendations;
  }

  analyzeErrorPatterns() {
    const issues = this.results.issues;
    const patterns = [];
    
    // Database connection issues
    if (issues.some(issue => issue.toLowerCase().includes('database') || issue.toLowerCase().includes('connection'))) {
      patterns.push('Review database connection configuration and pool settings');
    }
    
    // Sequence/ID issues
    if (issues.some(issue => issue.toLowerCase().includes('sequence') || issue.toLowerCase().includes('id'))) {
      patterns.push('Verify sequence initialization and ID generation logic');
    }
    
    // Timeout issues
    if (issues.some(issue => issue.toLowerCase().includes('timeout'))) {
      patterns.push('Investigate timeout issues and consider increasing limits for complex operations');
    }
    
    // Permission issues
    if (issues.some(issue => issue.toLowerCase().includes('permission') || issue.toLowerCase().includes('access'))) {
      patterns.push('Check database permissions and user access rights');
    }
    
    return patterns;
  }

  async generateFinalReport() {
    const report = {
      ...this.results,
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };

    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPREHENSIVE VERIFICATION TEST REPORT');
    console.log('='.repeat(80));
    
    // Overall Status
    const statusEmoji = {
      success: '✅',
      partial_failure: '⚠️',
      critical_failure: '❌',
      running: '🔄'
    };
    
    console.log(`\nOverall Status: ${statusEmoji[report.overallStatus]} ${report.overallStatus.toUpperCase().replace('_', ' ')}`);
    console.log(`Total Duration: ${(report.totalDuration / 1000).toFixed(2)} seconds`);
    console.log(`Test Suites: ${report.summary.totalTests} total, ${report.summary.passedTests} passed, ${report.summary.failedTests} failed`);
    console.log(`Pass Rate: ${report.summary.passRate.toFixed(1)}%`);
    
    // Test Suite Details
    console.log('\n📋 Test Suite Results:');
    console.log('-'.repeat(50));
    
    Object.values(report.testSuites).forEach(suite => {
      const statusIcon = suite.passed ? '✅' : '❌';
      const priority = suite.priority.toUpperCase().padEnd(8);
      const duration = (suite.duration / 1000).toFixed(2);
      
      console.log(`${statusIcon} [${priority}] ${suite.name} (${duration}s)`);
      
      if (!suite.passed && suite.error) {
        console.log(`    Error: ${suite.error}`);
      }
    });
    
    // Issues Summary
    if (report.issues.length > 0) {
      console.log('\n⚠️  Issues Found:');
      console.log('-'.repeat(30));
      report.issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`);
      });
    }
    
    // Recommendations
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      console.log('-'.repeat(40));
      
      report.recommendations.forEach((rec, index) => {
        const priorityEmoji = {
          critical: '🚨',
          high: '🔥',
          medium: '⚠️',
          low: '💡',
          info: 'ℹ️'
        };
        
        console.log(`\n${index + 1}. ${priorityEmoji[rec.priority]} ${rec.title}`);
        console.log(`   ${rec.description}`);
        if (rec.actions.length > 0) {
          console.log(`   Actions:`);
          rec.actions.forEach(action => {
            console.log(`     • ${action}`);
          });
        }
      });
    }
    
    // Next Steps
    console.log('\n🎯 Next Steps:');
    console.log('-'.repeat(20));
    
    switch (report.overallStatus) {
      case 'success':
        console.log('   ✅ All tests passed! Ready to proceed with Phase 1');
        console.log('   • Begin inventory feature development');
        console.log('   • Set up production monitoring');
        console.log('   • Document verification process');
        break;
        
      case 'partial_failure':
        console.log('   ⚠️  Some tests failed but system is functional');
        console.log('   • Review and fix non-critical issues');
        console.log('   • Consider proceeding with Phase 1 cautiously');
        console.log('   • Implement additional monitoring');
        break;
        
      case 'critical_failure':
        console.log('   ❌ Critical issues must be resolved before proceeding');
        console.log('   • Fix all critical test failures');
        console.log('   • Re-run verification tests');
        console.log('   • Do not proceed to Phase 1 until all critical issues are resolved');
        break;
    }
    
    // Save detailed report to file
    try {
      const reportPath = path.join(__dirname, '..', 'VERIFICATION_REPORT.json');
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    } catch (error) {
      console.warn(`Warning: Could not save detailed report: ${error.message}`);
    }
    
    console.log('\n' + '='.repeat(80));
    
    return report;
  }
}

async function runAllVerificationTests() {
  const runner = new VerificationTestRunner();
  
  try {
    const report = await runner.runAllTests();
    
    // Exit with appropriate code
    process.exit(report.overallStatus === 'success' ? 0 : 1);
    
  } catch (error) {
    console.error('💥 Verification test suite failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runAllVerificationTests();
}

module.exports = { VerificationTestRunner, runAllVerificationTests };