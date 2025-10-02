#!/usr/bin/env node

/**
 * Concurrent load testing for auto-generated ID system
 * Simulates realistic lab usage with multiple users creating records simultaneously
 */

const idGenerationService = require('../services/idGenerationService');
const { performance } = require('perf_hooks');

class ConcurrentLoadTester {
  constructor() {
    this.results = {
      tests: [],
      summary: {
        totalRequests: 0,
        uniqueIds: 0,
        duplicates: 0,
        errors: 0,
        averageResponseTime: 0,
        maxResponseTime: 0,
        minResponseTime: Infinity
      }
    };
  }

  async runConcurrentTest(entityType, numRequests, testName) {
    console.log(`\n🔄 ${testName}`);
    console.log(`   Testing ${entityType} ID generation with ${numRequests} concurrent requests...`);
    
    const startTime = performance.now();
    const promises = [];
    const requestTimes = [];
    
    // Create concurrent requests
    for (let i = 0; i < numRequests; i++) {
      const requestStart = performance.now();
      const promise = idGenerationService.getNextId(entityType, `load-test-user-${i}`)
        .then(result => {
          const requestEnd = performance.now();
          requestTimes.push(requestEnd - requestStart);
          return { success: true, id: result.id, responseTime: requestEnd - requestStart };
        })
        .catch(error => {
          const requestEnd = performance.now();
          requestTimes.push(requestEnd - requestStart);
          return { success: false, error: error.message, responseTime: requestEnd - requestStart };
        });
      
      promises.push(promise);
    }
    
    // Wait for all requests to complete
    const results = await Promise.all(promises);
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    // Analyze results
    const successfulResults = results.filter(r => r.success);
    const errors = results.filter(r => !r.success);
    const ids = successfulResults.map(r => r.id);
    const uniqueIds = new Set(ids);
    const duplicates = ids.length - uniqueIds.size;
    
    // Calculate statistics
    const avgResponseTime = requestTimes.reduce((a, b) => a + b, 0) / requestTimes.length;
    const maxResponseTime = Math.max(...requestTimes);
    const minResponseTime = Math.min(...requestTimes);
    
    const testResult = {
      testName,
      entityType,
      numRequests,
      totalTime,
      successfulRequests: successfulResults.length,
      errors: errors.length,
      uniqueIds: uniqueIds.size,
      duplicates,
      avgResponseTime,
      maxResponseTime,
      minResponseTime,
      throughput: numRequests / (totalTime / 1000), // requests per second
      errorRate: (errors.length / numRequests) * 100
    };
    
    this.results.tests.push(testResult);
    
    // Update summary
    this.results.summary.totalRequests += numRequests;
    this.results.summary.uniqueIds += uniqueIds.size;
    this.results.summary.duplicates += duplicates;
    this.results.summary.errors += errors.length;
    
    // Display results
    console.log(`   Results: ${successfulResults.length}/${numRequests} successful`);
    console.log(`   Unique IDs: ${uniqueIds.size} (${duplicates} duplicates)`);
    console.log(`   Response time: avg=${avgResponseTime.toFixed(2)}ms, max=${maxResponseTime.toFixed(2)}ms`);
    console.log(`   Throughput: ${testResult.throughput.toFixed(2)} requests/sec`);
    console.log(`   Error rate: ${testResult.errorRate.toFixed(2)}%`);
    
    if (duplicates > 0) {
      console.log(`   ❌ CRITICAL: ${duplicates} duplicate IDs found!`);
      console.log(`   Duplicate IDs: ${[...ids.filter((id, index) => ids.indexOf(id) !== index)]}`);
    } else {
      console.log(`   ✅ No duplicate IDs found`);
    }
    
    if (errors.length > 0) {
      console.log(`   ⚠️  ${errors.length} errors occurred:`);
      errors.slice(0, 3).forEach((error, index) => {
        console.log(`      ${index + 1}. ${error.error}`);
      });
      if (errors.length > 3) {
        console.log(`      ... and ${errors.length - 3} more`);
      }
    }
    
    return testResult;
  }

  async runStressTest() {
    console.log(`\n💪 Stress Test: High Concurrency Simulation`);
    console.log(`   Simulating 50 users each creating 5 records simultaneously (250 total requests)...`);
    
    const startTime = performance.now();
    const batches = [];
    
    // Create 50 batches of 5 requests each (simulating 50 users each creating 5 records)
    for (let batch = 0; batch < 50; batch++) {
      const batchPromises = [];
      for (let req = 0; req < 5; req++) {
        const entityTypes = ['collaborator', 'project', 'specimen'];
        const entityType = entityTypes[req % 3]; // Rotate through entity types
        
        batchPromises.push(
          idGenerationService.getNextId(entityType, `stress-user-${batch}`)
            .then(result => ({ success: true, id: result.id, entityType, batch, req }))
            .catch(error => ({ success: false, error: error.message, entityType, batch, req }))
        );
      }
      batches.push(Promise.all(batchPromises));
    }
    
    // Execute all batches concurrently
    const batchResults = await Promise.all(batches);
    const endTime = performance.now();
    
    // Flatten results
    const allResults = batchResults.flat();
    const successfulResults = allResults.filter(r => r.success);
    const errors = allResults.filter(r => !r.success);
    
    // Group by entity type to check for duplicates
    const resultsByEntity = {
      collaborator: successfulResults.filter(r => r.entityType === 'collaborator'),
      project: successfulResults.filter(r => r.entityType === 'project'),
      specimen: successfulResults.filter(r => r.entityType === 'specimen')
    };
    
    let totalDuplicates = 0;
    Object.entries(resultsByEntity).forEach(([entityType, results]) => {
      const ids = results.map(r => r.id);
      const uniqueIds = new Set(ids);
      const duplicates = ids.length - uniqueIds.size;
      totalDuplicates += duplicates;
      
      console.log(`   ${entityType}: ${results.length} requests, ${uniqueIds.size} unique IDs, ${duplicates} duplicates`);
    });
    
    const totalTime = endTime - startTime;
    const throughput = allResults.length / (totalTime / 1000);
    
    console.log(`   Total: ${successfulResults.length}/${allResults.length} successful`);
    console.log(`   Total duplicates: ${totalDuplicates}`);
    console.log(`   Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`   Throughput: ${throughput.toFixed(2)} requests/sec`);
    console.log(`   ${totalDuplicates === 0 ? '✅' : '❌'} Stress test ${totalDuplicates === 0 ? 'PASSED' : 'FAILED'}`);
    
    return {
      testName: 'High Concurrency Stress Test',
      totalRequests: allResults.length,
      successfulRequests: successfulResults.length,
      errors: errors.length,
      totalDuplicates,
      totalTime,
      throughput,
      passed: totalDuplicates === 0 && errors.length === 0
    };
  }

  async runRealisticWorkflowTest() {
    console.log(`\n🏥 Realistic Lab Workflow Test`);
    console.log(`   Simulating typical lab workflow with mixed operations...`);
    
    const scenarios = [
      { name: 'New collaborator setup', entityType: 'collaborator', count: 5 },
      { name: 'Project creation batch', entityType: 'project', count: 15 },
      { name: 'Sample processing batch', entityType: 'specimen', count: 50 },
      { name: 'Additional samples', entityType: 'specimen', count: 25 }
    ];
    
    const startTime = performance.now();
    const allPromises = [];
    
    // Run scenarios concurrently to simulate real usage
    scenarios.forEach((scenario, scenarioIndex) => {
      for (let i = 0; i < scenario.count; i++) {
        const promise = idGenerationService.getNextId(
          scenario.entityType, 
          `workflow-${scenario.name.replace(/\s+/g, '-')}-${i}`
        )
        .then(result => ({ 
          success: true, 
          id: result.id, 
          entityType: scenario.entityType,
          scenario: scenario.name
        }))
        .catch(error => ({ 
          success: false, 
          error: error.message, 
          entityType: scenario.entityType,
          scenario: scenario.name
        }));
        
        allPromises.push(promise);
      }
    });
    
    const results = await Promise.all(allPromises);
    const endTime = performance.now();
    
    // Analyze results by entity type
    const analysisByEntity = {};
    ['collaborator', 'project', 'specimen'].forEach(entityType => {
      const entityResults = results.filter(r => r.entityType === entityType);
      const successful = entityResults.filter(r => r.success);
      const ids = successful.map(r => r.id);
      const uniqueIds = new Set(ids);
      const duplicates = ids.length - uniqueIds.size;
      
      analysisByEntity[entityType] = {
        total: entityResults.length,
        successful: successful.length,
        uniqueIds: uniqueIds.size,
        duplicates
      };
    });
    
    const totalTime = endTime - startTime;
    const totalSuccessful = results.filter(r => r.success).length;
    const totalDuplicates = Object.values(analysisByEntity).reduce((sum, data) => sum + data.duplicates, 0);
    
    console.log(`   Results by entity type:`);
    Object.entries(analysisByEntity).forEach(([entityType, data]) => {
      console.log(`     ${entityType}: ${data.successful}/${data.total} successful, ${data.duplicates} duplicates`);
    });
    
    console.log(`   Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`   Success rate: ${(totalSuccessful / results.length * 100).toFixed(2)}%`);
    console.log(`   ${totalDuplicates === 0 ? '✅' : '❌'} Workflow test ${totalDuplicates === 0 ? 'PASSED' : 'FAILED'}`);
    
    return {
      testName: 'Realistic Lab Workflow',
      totalRequests: results.length,
      successfulRequests: totalSuccessful,
      totalDuplicates,
      totalTime,
      analysisByEntity,
      passed: totalDuplicates === 0
    };
  }

  generateSummaryReport() {
    console.log('\n📊 Concurrent Load Testing Summary');
    console.log('===================================\n');
    
    const allTests = [...this.results.tests];
    if (this.stressTestResult) allTests.push(this.stressTestResult);
    if (this.workflowTestResult) allTests.push(this.workflowTestResult);
    
    // Overall statistics
    const totalRequests = allTests.reduce((sum, test) => sum + test.totalRequests, 0);
    const totalDuplicates = allTests.reduce((sum, test) => sum + (test.duplicates || test.totalDuplicates || 0), 0);
    const totalErrors = allTests.reduce((sum, test) => sum + test.errors, 0);
    const allPassed = allTests.every(test => test.passed !== false && (test.duplicates || test.totalDuplicates || 0) === 0);
    
    console.log(`Overall Status: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    console.log(`Total Requests: ${totalRequests}`);
    console.log(`Total Duplicates: ${totalDuplicates}`);
    console.log(`Total Errors: ${totalErrors}`);
    console.log(`Success Rate: ${((totalRequests - totalErrors) / totalRequests * 100).toFixed(2)}%`);
    
    if (totalDuplicates > 0) {
      console.log('\n⚠️  CRITICAL ISSUE: Duplicate IDs were generated!');
      console.log('This indicates the ID generation system is not thread-safe.');
    }
    
    console.log('\nTest Details:');
    allTests.forEach(test => {
      const status = test.passed !== false && (test.duplicates || test.totalDuplicates || 0) === 0 ? '✅' : '❌';
      console.log(`  ${status} ${test.testName}: ${test.successfulRequests || test.totalRequests}/${test.totalRequests} successful`);
    });
    
    return {
      passed: allPassed,
      totalRequests,
      totalDuplicates,
      totalErrors,
      tests: allTests
    };
  }
}

async function runConcurrentLoadTests() {
  console.log('🚀 Starting Concurrent Load Testing for Auto-Generated IDs...\n');
  console.log('This will test the system under realistic concurrent usage scenarios.\n');
  
  const tester = new ConcurrentLoadTester();
  
  try {
    // Test 1: Basic concurrent generation for each entity type
    await tester.runConcurrentTest('collaborator', 20, 'Basic Collaborator Concurrency Test');
    await tester.runConcurrentTest('project', 30, 'Basic Project Concurrency Test');  
    await tester.runConcurrentTest('specimen', 50, 'Basic Specimen Concurrency Test');
    
    // Test 2: Mixed entity type concurrent generation
    console.log(`\n🔀 Mixed Entity Type Test`);
    console.log(`   Testing concurrent generation across all entity types...`);
    
    const mixedPromises = [];
    const entityTypes = ['collaborator', 'project', 'specimen'];
    
    for (let i = 0; i < 30; i++) {
      const entityType = entityTypes[i % 3];
      mixedPromises.push(
        idGenerationService.getNextId(entityType, `mixed-test-${i}`)
          .then(result => ({ success: true, id: result.id, entityType }))
          .catch(error => ({ success: false, error: error.message, entityType }))
      );
    }
    
    const mixedResults = await Promise.all(mixedPromises);
    
    // Check for duplicates within each entity type
    const mixedAnalysis = {};
    entityTypes.forEach(entityType => {
      const entityResults = mixedResults.filter(r => r.success && r.entityType === entityType);
      const ids = entityResults.map(r => r.id);
      const uniqueIds = new Set(ids);
      mixedAnalysis[entityType] = {
        total: entityResults.length,
        unique: uniqueIds.size,
        duplicates: ids.length - uniqueIds.size
      };
    });
    
    console.log(`   Results:`);
    Object.entries(mixedAnalysis).forEach(([entityType, data]) => {
      console.log(`     ${entityType}: ${data.total} generated, ${data.duplicates} duplicates ${data.duplicates === 0 ? '✅' : '❌'}`);
    });
    
    // Test 3: High-concurrency stress test
    tester.stressTestResult = await tester.runStressTest();
    
    // Test 4: Realistic workflow simulation
    tester.workflowTestResult = await tester.runRealisticWorkflowTest();
    
    // Generate final report
    const finalReport = tester.generateSummaryReport();
    
    if (finalReport.passed) {
      console.log('\n🎉 All concurrent load tests passed!');
      console.log('✅ ID generation system is thread-safe under realistic load');
      console.log('✅ No duplicate IDs generated across all test scenarios');
      console.log('✅ System handles concurrent users effectively');
    } else {
      console.log('\n⚠️  Some concurrent load tests failed!');
      console.log('Review the test results above for specific issues.');
    }
    
    return finalReport;
    
  } catch (error) {
    console.error('💥 Load testing failed:', error);
    return { passed: false, error: error.message };
  }
}

if (require.main === module) {
  runConcurrentLoadTests()
    .then(result => {
      process.exit(result.passed ? 0 : 1);
    })
    .catch(error => {
      console.error('Script execution failed:', error);
      process.exit(1);
    });
}

module.exports = { runConcurrentLoadTests, ConcurrentLoadTester };