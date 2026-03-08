<?php
/**
 * 通用工具函数
 */

/**
 * 安全输出HTML（防XSS）
 */
function e($string) {
    return htmlspecialchars($string ?? '', ENT_QUOTES, 'UTF-8');
}

/**
 * 重定向
 */
function redirect($url) {
    header("Location: $url");
    exit;
}

/**
 * 设置Flash消息
 */
function setFlash($type, $message) {
    $_SESSION['flash'] = ['type' => $type, 'message' => $message];
}

/**
 * 获取并清除Flash消息
 */
function getFlash() {
    if (isset($_SESSION['flash'])) {
        $flash = $_SESSION['flash'];
        unset($_SESSION['flash']);
        return $flash;
    }
    return null;
}

/**
 * 显示Flash消息HTML
 */
function displayFlash() {
    $flash = getFlash();
    if ($flash) {
        $type = $flash['type'];
        $message = e($flash['message']);
        $alertClass = $type === 'success' ? 'alert-success' : 'alert-danger';
        echo "<div class='alert $alertClass alert-dismissible fade show' role='alert'>
                $message
                <button type='button' class='btn-close' data-bs-dismiss='alert'></button>
              </div>";
    }
}

/**
 * 分页计算
 */
function paginate($total, $page, $perPage = ITEMS_PER_PAGE) {
    $totalPages = ceil($total / $perPage);
    $page = max(1, min($page, $totalPages));
    $offset = ($page - 1) * $perPage;

    return [
        'total' => $total,
        'per_page' => $perPage,
        'current_page' => $page,
        'total_pages' => $totalPages,
        'offset' => $offset
    ];
}

/**
 * 显示分页HTML
 */
function displayPagination($pagination, $baseUrl) {
    if ($pagination['total_pages'] <= 1) return;

    echo '<nav><ul class="pagination justify-content-center">';

    for ($i = 1; $i <= $pagination['total_pages']; $i++) {
        $active = $i === $pagination['current_page'] ? 'active' : '';
        $url = $baseUrl . (strpos($baseUrl, '?') ? '&' : '?') . "page=$i";
        echo "<li class='page-item $active'><a class='page-link' href='$url'>$i</a></li>";
    }

    echo '</ul></nav>';
}

/**
 * 格式化日期时间
 */
function formatDateTime($datetime) {
    return date('Y-m-d H:i:s', strtotime($datetime));
}

/**
 * 题型中文名称
 */
function getQuestionTypeName($type) {
    $types = [
        'single' => '单选题',
        'multiple' => '多选题',
        'judge' => '判断题',
        'code' => '编程题',
        'essay' => '简答题'
    ];
    return $types[$type] ?? '未知';
}

/**
 * 渲染题目文本（支持代码块）
 */
function renderQuestionText($text) {
    if (empty($text)) return '';

    // 将 ```语言\n代码\n``` 格式渲染成代码块
    $text = preg_replace_callback(
        '/```(\w+)?\n(.*?)\n```/s',
        function($matches) {
            $lang = $matches[1] ?: 'text';
            $code = htmlspecialchars($matches[2]);
            return '<pre><code class="language-' . $lang . '">' . $code . '</code></pre>';
        },
        $text
    );

    // 支持行内代码 `code`
    $text = preg_replace('/`([^`]+)`/', '<code>$1</code>', $text);

    // 保留换行
    return nl2br($text);
}
