FROM jjrom/s6-overlay:3.1.6.2-mantic
LABEL maintainer="jerome.gasperi@gmail.com"

# Add ppa, curl and syslogd
RUN apt-get update && \
    apt-get install -y \
    software-properties-common \
    curl \
    inetutils-syslogd \
    zip \
    unzip \
    gettext-base \
    nginx && \
    apt-get autoremove -y && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy NGINX service script
COPY ./build/start-nginx.sh /etc/services.d/nginx/run
RUN chmod 755 /etc/services.d/nginx/run

# Copy NGINX configuration
COPY ./build/container_root/etc/nginx /etc/nginx

# Copy run.d configuration
COPY ./build/container_root/cont-init.d /etc/cont-init.d

# Copy source code in app directory
RUN mkdir /app
COPY ./app/dist/app/browser /app
