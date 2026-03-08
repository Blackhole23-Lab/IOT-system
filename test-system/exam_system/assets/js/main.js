// 通用JavaScript函数

// 确认删除
function confirmDelete(message) {
    return confirm(message || '确定要删除吗？此操作不可恢复！');
}

// 自动隐藏提示消息
document.addEventListener('DOMContentLoaded', function() {
    const alerts = document.querySelectorAll('.alert-dismissible');
    alerts.forEach(function(alert) {
        setTimeout(function() {
            const bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        }, 5000);
    });
});
