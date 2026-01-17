# base image of nginx
FROM nginx:1.29.4

# copy index.html to the nginx html folder
COPY index.html /usr/share/nginx/html

# copy the nginx configuration to the correct location
COPY nginx.conf /etc/nginx/conf.d/default.conf 

# expose port 8080
EXPOSE 8080

# health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD curl -f http://127.0.0.1:8080/healthz || exit 1

