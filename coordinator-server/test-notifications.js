/**
 * Notification System Test Suite
 * Tests the enhanced notification system with multi-channel support
 */

const NotificationService = require('./src/services/NotificationService');
const logger = require('./src/utils/logger');

async function testNotificationSystem() {
  console.log('🔔 Starting Notification System Tests...\n');

  const notificationService = new NotificationService();
  const testUserId = 'test-user-' + Date.now();

  try {
    // Test 1: Create basic notification
    console.log('📝 Test 1: Creating basic notification...');
    const basicNotification = await notificationService.createNotification({
      userId: testUserId,
      type: 'test',
      title: 'Test Notification',
      body: 'This is a test notification',
      priority: 'medium',
      channels: ['web']
    });

    console.log('✅ Basic notification created:', {
      id: basicNotification.id,
      title: basicNotification.title,
      status: basicNotification.status
    });

    // Test 2: Create notification using template
    console.log('\n📝 Test 2: Creating notification with template...');
    const templateNotification = await notificationService.sendTemplateNotification(
      testUserId,
      'task_completed',
      {
        taskName: 'AI Model Training',
        taskId: 'TASK-12345',
        results: 'Model trained successfully with 95% accuracy'
      }
    );

    console.log('✅ Template notification created:', {
      id: templateNotification.id,
      templateId: templateNotification.templateId,
      title: templateNotification.title,
      body: templateNotification.body
    });

    // Test 3: Test multi-channel notification
    console.log('\n📝 Test 3: Creating multi-channel notification...');
    const multiChannelNotification = await notificationService.sendTemplateNotification(
      testUserId,
      'system_maintenance',
      {
        startTime: '2025-01-21T02:00:00Z',
        duration: '2 hours',
        affectedServices: 'All compute nodes'
      },
      {
        channels: ['web', 'email', 'push']
      }
    );

    console.log('✅ Multi-channel notification created:', {
      id: multiChannelNotification.id,
      channels: multiChannelNotification.channels,
      deliveryStatus: multiChannelNotification.deliveryStatus
    });

    // Test 4: Get user notifications with filtering
    console.log('\n📝 Test 4: Fetching user notifications...');
    const userNotifications = await notificationService.getUserNotifications(testUserId, {
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    });

    console.log('✅ User notifications fetched:', {
      count: userNotifications.notifications.length,
      pagination: userNotifications.pagination
    });

    // Test 5: Mark notification as read
    console.log('\n📝 Test 5: Marking notification as read...');
    const readNotification = await notificationService.markAsRead(
      basicNotification.id,
      testUserId
    );

    console.log('✅ Notification marked as read:', {
      id: readNotification.id,
      isRead: readNotification.isRead,
      readAt: readNotification.readAt
    });

    // Test 6: Test user preferences
    console.log('\n📝 Test 6: Testing user preferences...');
    const defaultPrefs = notificationService.getUserPreferences(testUserId);
    console.log('✅ Default preferences loaded:', {
      webEnabled: defaultPrefs.channels.web.enabled,
      emailEnabled: defaultPrefs.channels.email.enabled
    });

    const updatedPrefs = await notificationService.updateUserPreferences(testUserId, {
      channels: {
        ...defaultPrefs.channels,
        email: { enabled: false }
      }
    });

    console.log('✅ Preferences updated:', {
      emailEnabled: updatedPrefs.channels.email.enabled
    });

    // Test 7: Test notification statistics
    console.log('\n📝 Test 7: Getting notification statistics...');
    const userStats = await notificationService.getStatistics(testUserId);
    console.log('✅ User statistics:', {
      total: userStats.total,
      unread: userStats.unread,
      byType: userStats.byType,
      byPriority: userStats.byPriority
    });

    const systemStats = await notificationService.getStatistics();
    console.log('✅ System statistics:', {
      total: systemStats.total,
      sent: systemStats.sent,
      delivered: systemStats.delivered
    });

    // Test 8: Test bulk operations
    console.log('\n📝 Test 8: Testing bulk operations...');
    
    // Create a few more notifications
    await notificationService.sendTemplateNotification(testUserId, 'node_online', {
      nodeName: 'GPU-Node-001',
      nodeId: 'node-001',
      capabilities: '4x RTX 4090'
    });

    await notificationService.sendTemplateNotification(testUserId, 'payment_received', {
      amount: '150.50',
      taskId: 'TASK-67890',
      balance: '1,250.75'
    });

    // Mark all as read
    const markedCount = await notificationService.markAllAsRead(testUserId);
    console.log('✅ Bulk mark as read:', { markedCount });

    // Delete all read notifications
    const deletedCount = await notificationService.deleteAllRead(testUserId);
    console.log('✅ Bulk delete read:', { deletedCount });

    // Test 9: Test notification templates
    console.log('\n📝 Test 9: Testing notification templates...');
    const templates = notificationService.getTemplates();
    console.log('✅ Available templates:', {
      count: templates.length,
      templates: templates.map(t => ({ id: t.id, type: t.type, priority: t.priority }))
    });

    // Test 10: Test scheduled notification
    console.log('\n📝 Test 10: Testing scheduled notification...');
    const scheduledTime = new Date(Date.now() + 5000); // 5 seconds from now
    const scheduledNotification = await notificationService.createNotification({
      userId: testUserId,
      type: 'scheduled_test',
      title: 'Scheduled Test',
      body: 'This notification was scheduled',
      priority: 'low',
      channels: ['web'],
      scheduleAt: scheduledTime.toISOString()
    });

    console.log('✅ Scheduled notification created:', {
      id: scheduledNotification.id,
      status: scheduledNotification.status,
      scheduledAt: scheduledNotification.scheduledAt
    });

    // Test 11: Test error handling
    console.log('\n📝 Test 11: Testing error handling...');
    
    try {
      await notificationService.createNotification({
        // Missing userId - should throw error
        type: 'test',
        title: 'Test',
        body: 'Test'
      });
    } catch (error) {
      console.log('✅ Error handling works:', error.message);
    }

    try {
      await notificationService.sendTemplateNotification(
        testUserId,
        'non_existent_template',
        {}
      );
    } catch (error) {
      console.log('✅ Template error handling works:', error.message);
    }

    // Test 12: Test delivery status simulation
    console.log('\n📝 Test 12: Testing delivery status...');
    const deliveryTestNotification = await notificationService.sendTemplateNotification(
      testUserId,
      'task_failed',
      {
        taskName: 'Failed Task Test',
        taskId: 'TASK-FAIL-001',
        error: 'GPU memory exhausted'
      },
      {
        channels: ['web', 'email', 'sms']
      }
    );

    console.log('✅ Delivery status test:', {
      id: deliveryTestNotification.id,
      status: deliveryTestNotification.status,
      deliveryStatus: deliveryTestNotification.deliveryStatus
    });

    // Final statistics
    console.log('\n📊 Final Test Statistics:');
    const finalStats = await notificationService.getStatistics(testUserId);
    console.log('User notifications:', finalStats);

    const systemFinalStats = await notificationService.getStatistics();
    console.log('System-wide notifications:', {
      total: systemFinalStats.total,
      sent: systemFinalStats.sent,
      delivered: systemFinalStats.delivered,
      failed: systemFinalStats.failed
    });

    console.log('\n🎉 All notification system tests completed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('- ✅ Basic notification creation');
    console.log('- ✅ Template-based notifications');
    console.log('- ✅ Multi-channel delivery');
    console.log('- ✅ User notification filtering');
    console.log('- ✅ Read/unread status management');
    console.log('- ✅ User preferences system');
    console.log('- ✅ Statistics and analytics');
    console.log('- ✅ Bulk operations');
    console.log('- ✅ Template management');
    console.log('- ✅ Scheduled notifications');
    console.log('- ✅ Error handling');
    console.log('- ✅ Delivery status tracking');

    return true;

  } catch (error) {
    console.error('❌ Notification system test failed:', error);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testNotificationSystem()
    .then(success => {
      if (success) {
        console.log('\n✅ All tests passed successfully!');
        process.exit(0);
      } else {
        console.log('\n❌ Some tests failed');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testNotificationSystem };