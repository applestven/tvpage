#!/bin/bash
ssh ubuntu@139.199.192.179

## nginx 日志访问
# cd /var/log/nginx/
# sudo npx serve . -l 9797
# http://139.199.192.179:9797/

## 日志扩展
# nc -zv 139.199.192.179 9797 验证
# sudo ln -s /etc/nginx/sites-available/log-panel.conf /etc/nginx/sites-enabled/log-panel.conf
# sudo nginx -t
# sudo systemctl reload nginx