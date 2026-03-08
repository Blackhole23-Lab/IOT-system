<?php
/**
 * 用户登出
 */
require_once 'includes/config.php';
require_once 'includes/auth.php';

logoutUser();
header('Location: index.php');
exit;
