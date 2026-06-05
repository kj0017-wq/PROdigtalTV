FROM php:8.3-apache

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html
RUN apt-get update \
  && apt-get install -y --no-install-recommends libcurl4-openssl-dev unzip \
  && docker-php-ext-install curl \
  && rm -rf /var/lib/apt/lists/*

COPY composer.json ./
RUN composer install --no-dev --prefer-dist --no-interaction --no-progress --optimize-autoloader

COPY public ./public
COPY src ./src
COPY apache-vhost.conf /etc/apache2/sites-available/000-default.conf
RUN a2enmod rewrite

ENV PORT=8080
RUN sed -i 's/Listen 80/Listen 8080/' /etc/apache2/ports.conf
EXPOSE 8080
