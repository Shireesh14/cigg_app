# Use the official PostgreSQL image from the Docker Hub
FROM postgres:18.1

# initialize the database
COPY init.sql /docker-entrypoint-initdb.d/

# Set environment variables for PostgreSQL
ENV POSTGRES_USER=${POSTGRES_USER}
ENV POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
ENV POSTGRES_DB=${POSTGRES_DB}

# Expose the default PostgreSQL port
EXPOSE 5432