# Nginx Configuration for Large File Uploads

Add or update the following inside your `server` block for the backend subdomain.

```nginx
server {
    listen 443 ssl;
    server_name digiwholesale-backend.digibysr.in;

    # Allow up to 50MB uploads (match your Multer limit)
    client_max_body_size 50M;

    # Prevent Nginx from timing out on large uploads
    client_body_timeout        120s;
    client_header_timeout      60s;

    # Prevent proxy from timing out while Node processes the upload
    proxy_read_timeout         300s;
    proxy_send_timeout         300s;
    proxy_connect_timeout      60s;

    # Buffer settings — disable buffering for uploads so data streams directly
    proxy_request_buffering    off;
    proxy_buffering            off;

    location / {
        proxy_pass         http://localhost:8080;
        proxy_http_version 1.1;

        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

After editing, reload Nginx:
```bash
sudo nginx -t && sudo systemctl reload nginx
```
