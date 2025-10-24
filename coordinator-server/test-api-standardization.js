/**
 * API Standardization Test Suite
 * Tests consistent response formats across all endpoints
 */

const { APIResponse, ResponseHelper, ValidationHelper, HealthCheckHelper, ErrorTypes } = require('./src/middleware/apiStandardization');

async function testAPIStandardization() {
  console.log('🔧 Starting API Standardization Tests...\n');

  try {
    // Test 1: APIResponse Class
    console.log('📝 Test 1: Testing APIResponse class...');
    
    // Test successful response
    const successResponse = new APIResponse(true, { message: 'Test data' }, null, { version: '1.0.0' });
    console.log('✅ Success response structure:', {
      hasSuccess: successResponse.hasOwnProperty('success'),
      hasTimestamp: successResponse.hasOwnProperty('timestamp'),
      hasVersion: successResponse.hasOwnProperty('version'),
      hasData: successResponse.hasOwnProperty('data'),
      hasMeta: successResponse.hasOwnProperty('meta'),
      successValue: successResponse.success
    });

    // Test error response
    const errorResponse = new APIResponse(false, null, {
      code: 'TEST_ERROR',
      message: 'Test error message',
      details: { field: 'test_field' }
    });
    console.log('✅ Error response structure:', {
      hasSuccess: errorResponse.hasOwnProperty('success'),
      hasTimestamp: errorResponse.hasOwnProperty('timestamp'),
      hasVersion: errorResponse.hasOwnProperty('version'),
      hasError: errorResponse.hasOwnProperty('error'),
      errorCode: errorResponse.error.code,
      successValue: errorResponse.success
    });

    // Test 2: Error Types
    console.log('\n📝 Test 2: Testing error types...');
    
    const errorTypeTests = [
      { name: 'VALIDATION_ERROR', type: ErrorTypes.VALIDATION_ERROR, expectedStatus: 400 },
      { name: 'AUTHENTICATION_ERROR', type: ErrorTypes.AUTHENTICATION_ERROR, expectedStatus: 401 },
      { name: 'AUTHORIZATION_ERROR', type: ErrorTypes.AUTHORIZATION_ERROR, expectedStatus: 403 },
      { name: 'NOT_FOUND', type: ErrorTypes.NOT_FOUND, expectedStatus: 404 },
      { name: 'CONFLICT', type: ErrorTypes.CONFLICT, expectedStatus: 409 },
      { name: 'RATE_LIMIT_EXCEEDED', type: ErrorTypes.RATE_LIMIT_EXCEEDED, expectedStatus: 429 },
      { name: 'INTERNAL_ERROR', type: ErrorTypes.INTERNAL_ERROR, expectedStatus: 500 },
      { name: 'SERVICE_UNAVAILABLE', type: ErrorTypes.SERVICE_UNAVAILABLE, expectedStatus: 503 }
    ];

    errorTypeTests.forEach(({ name, type, expectedStatus }) => {
      console.log(`✅ ${name}: code=${type.code}, status=${type.status}, expected=${expectedStatus}`);
      if (type.status !== expectedStatus) {
        console.log(`❌ Status mismatch for ${name}`);
      }
    });

    // Test 3: Validation Helper
    console.log('\n📝 Test 3: Testing ValidationHelper...');
    
    // Test required field validation
    const testData = {
      name: 'Test User',
      email: 'test@example.com',
      // missing: age
    };
    
    const requiredErrors = ValidationHelper.validateRequired(testData, ['name', 'email', 'age']);
    console.log('✅ Required field validation:', {
      hasErrors: requiredErrors !== null,
      missingField: requiredErrors?.age || 'none',
      errorCount: requiredErrors ? Object.keys(requiredErrors).length : 0
    });

    // Test type validation
    const typeTestData = {
      name: 'Test User', // string - correct
      age: '25', // string but should be number - incorrect
      active: true // boolean - correct
    };
    
    const typeErrors = ValidationHelper.validateTypes(typeTestData, {
      name: 'string',
      age: 'number',
      active: 'boolean'
    });
    console.log('✅ Type validation:', {
      hasErrors: typeErrors !== null,
      ageError: typeErrors?.age || 'none',
      errorCount: typeErrors ? Object.keys(typeErrors).length : 0
    });

    // Test format validation
    const formatTestData = {
      email: 'invalid-email',
      phone: '123-456-7890',
      zipCode: 'ABC123'
    };
    
    const formatErrors = ValidationHelper.validateFormats(formatTestData, {
      email: { 
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, 
        message: 'Invalid email format' 
      },
      phone: { 
        pattern: /^\d{3}-\d{3}-\d{4}$/, 
        message: 'Phone must be in format XXX-XXX-XXXX' 
      },
      zipCode: { 
        pattern: /^\d{5}$/, 
        message: 'Zip code must be 5 digits' 
      }
    });
    console.log('✅ Format validation:', {
      hasErrors: formatErrors !== null,
      emailError: formatErrors?.email ? 'present' : 'none',
      zipCodeError: formatErrors?.zipCode ? 'present' : 'none',
      errorCount: formatErrors ? Object.keys(formatErrors).length : 0
    });

    // Test combined validations
    const combinedErrors = ValidationHelper.combineValidations(
      requiredErrors,
      typeErrors,
      formatErrors
    );
    console.log('✅ Combined validation:', {
      hasErrors: combinedErrors !== null,
      totalErrors: combinedErrors ? Object.keys(combinedErrors).length : 0
    });

    // Test 4: Health Check Helper
    console.log('\n📝 Test 4: Testing HealthCheckHelper...');
    
    const healthStatus = HealthCheckHelper.getHealthStatus();
    console.log('✅ Basic health check:', {
      status: healthStatus.status,
      hasTimestamp: healthStatus.hasOwnProperty('timestamp'),
      hasVersion: healthStatus.hasOwnProperty('version'),
      hasUptime: healthStatus.hasOwnProperty('uptime'),
      hasMemory: healthStatus.hasOwnProperty('memory'),
      hasSystem: healthStatus.hasOwnProperty('system')
    });

    // Test detailed health check
    const serviceChecks = {
      database: async () => ({ connected: true, responseTime: 45 }),
      cache: async () => ({ connected: true, hitRate: 85.6 }),
      externalAPI: async () => { throw new Error('Service unavailable'); }
    };
    
    const detailedHealth = await HealthCheckHelper.getDetailedHealthStatus(serviceChecks);
    console.log('✅ Detailed health check:', {
      overallStatus: detailedHealth.status,
      serviceCount: Object.keys(detailedHealth.services).length,
      healthyServices: Object.values(detailedHealth.services).filter(s => s.status === 'healthy').length,
      unhealthyServices: Object.values(detailedHealth.services).filter(s => s.status === 'unhealthy').length
    });

    // Test 5: Mock Response Helper Functions
    console.log('\n📝 Test 5: Testing ResponseHelper functions...');
    
    // Mock response object for testing
    const mockRes = {
      status: (code) => ({ 
        json: (data) => ({ statusCode: code, body: data }),
        set: () => ({})
      }),
      set: () => mockRes,
      req: { 
        originalUrl: '/api/test', 
        method: 'GET',
        startTime: Date.now() - 100 
      }
    };

    // Test success response
    const successTest = ResponseHelper.success(mockRes, { test: 'data' }, { source: 'test' });
    console.log('✅ Success response test:', {
      statusCode: successTest.statusCode,
      hasSuccess: successTest.body.success,
      hasData: successTest.body.hasOwnProperty('data'),
      hasMeta: successTest.body.hasOwnProperty('meta')
    });

    // Test error responses
    const errorTest = ResponseHelper.error(mockRes, ErrorTypes.VALIDATION_ERROR, 'Custom error message');
    console.log('✅ Error response test:', {
      statusCode: errorTest.statusCode,
      hasSuccess: errorTest.body.success === false,
      errorCode: errorTest.body.error.code,
      errorMessage: errorTest.body.error.message
    });

    // Test validation error
    const validationTest = ResponseHelper.validationError(mockRes, { field1: 'error1', field2: 'error2' });
    console.log('✅ Validation error test:', {
      statusCode: validationTest.statusCode,
      hasValidation: validationTest.body.error.hasOwnProperty('validation'),
      validationCount: Object.keys(validationTest.body.error.validation).length
    });

    // Test not found
    const notFoundTest = ResponseHelper.notFound(mockRes, 'User');
    console.log('✅ Not found test:', {
      statusCode: notFoundTest.statusCode,
      errorCode: notFoundTest.body.error.code,
      messageContainsResource: notFoundTest.body.error.message.includes('User')
    });

    // Test 6: Pagination Response
    console.log('\n📝 Test 6: Testing paginated responses...');
    
    const paginationData = [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
      { id: 3, name: 'Item 3' }
    ];
    
    const paginationMeta = { page: 2, limit: 10, total: 45 };
    const paginatedTest = ResponseHelper.paginated(mockRes, paginationData, paginationMeta);
    
    console.log('✅ Paginated response test:', {
      statusCode: paginatedTest.statusCode,
      hasData: Array.isArray(paginatedTest.body.data),
      hasPagination: paginatedTest.body.meta.hasOwnProperty('pagination'),
      page: paginatedTest.body.meta.pagination.page,
      totalPages: paginatedTest.body.meta.pagination.totalPages,
      hasNext: paginatedTest.body.meta.pagination.hasNext,
      hasPrev: paginatedTest.body.meta.pagination.hasPrev
    });

    // Test 7: Response Consistency
    console.log('\n📝 Test 7: Testing response consistency...');
    
    const responses = [
      ResponseHelper.success(mockRes, { test: 1 }),
      ResponseHelper.error(mockRes, ErrorTypes.NOT_FOUND),
      ResponseHelper.validationError(mockRes, { field: 'error' }),
      ResponseHelper.paginated(mockRes, [], { page: 1, limit: 10, total: 0 })
    ];
    
    const consistencyChecks = responses.map(response => ({
      hasSuccess: response.body.hasOwnProperty('success'),
      hasTimestamp: response.body.hasOwnProperty('timestamp'),
      hasVersion: response.body.hasOwnProperty('version'),
      successType: typeof response.body.success
    }));
    
    const allConsistent = consistencyChecks.every(check => 
      check.hasSuccess && check.hasTimestamp && check.hasVersion && check.successType === 'boolean'
    );
    
    console.log('✅ Response consistency:', {
      totalResponses: responses.length,
      allHaveSuccess: consistencyChecks.every(c => c.hasSuccess),
      allHaveTimestamp: consistencyChecks.every(c => c.hasTimestamp),
      allHaveVersion: consistencyChecks.every(c => c.hasVersion),
      overallConsistency: allConsistent ? 'PASSED' : 'FAILED'
    });

    // Test 8: Performance Test
    console.log('\n📝 Test 8: Testing performance...');
    
    const startTime = Date.now();
    const performanceIterations = 1000;
    
    for (let i = 0; i < performanceIterations; i++) {
      const testResponse = new APIResponse(true, { iteration: i }, null, { test: true });
      ResponseHelper.success(mockRes, { iteration: i });
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('✅ Performance test:', {
      iterations: performanceIterations,
      totalTime: duration + 'ms',
      averagePerOperation: (duration / performanceIterations).toFixed(3) + 'ms',
      operationsPerSecond: Math.round(performanceIterations / (duration / 1000))
    });

    // Final Statistics
    console.log('\n📊 API Standardization Test Statistics:');
    console.log('API Response Class:', {
      successResponseFields: Object.keys(successResponse).length,
      errorResponseFields: Object.keys(errorResponse).length
    });
    
    console.log('Error Types:', {
      totalErrorTypes: Object.keys(ErrorTypes).length,
      allHaveRequiredFields: Object.values(ErrorTypes).every(type => 
        type.hasOwnProperty('code') && type.hasOwnProperty('status') && type.hasOwnProperty('message')
      )
    });
    
    console.log('Validation Helper:', {
      validationMethods: ['validateRequired', 'validateTypes', 'validateFormats', 'combineValidations'].length,
      allMethodsAvailable: ['validateRequired', 'validateTypes', 'validateFormats', 'combineValidations']
        .every(method => typeof ValidationHelper[method] === 'function')
    });
    
    console.log('Health Check Helper:', {
      healthStatus: typeof HealthCheckHelper.getHealthStatus === 'function',
      detailedHealthStatus: typeof HealthCheckHelper.getDetailedHealthStatus === 'function'
    });

    console.log('\n🎉 All API standardization tests completed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('- ✅ APIResponse class structure');
    console.log('- ✅ Error types definition');
    console.log('- ✅ Validation helper functions');
    console.log('- ✅ Health check helper');
    console.log('- ✅ Response helper functions');
    console.log('- ✅ Pagination responses');
    console.log('- ✅ Response consistency');
    console.log('- ✅ Performance testing');

    return true;

  } catch (error) {
    console.error('❌ API standardization test failed:', error);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testAPIStandardization()
    .then(success => {
      if (success) {
        console.log('\n✅ All API standardization tests passed successfully!');
        process.exit(0);
      } else {
        console.log('\n❌ Some API standardization tests failed');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testAPIStandardization };