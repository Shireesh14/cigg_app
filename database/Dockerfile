# Use the official PostgreSQL image from the Docker Hub
FROM postgres:18.1

# initialize the database
COPY init.sql /docker-entrypoint-initdb.d/

# Set environment variables for PostgreSQL
ENV POSTGRES_USER=cigtracker
ENV POSTGRES_PASSWORD=password
ENV POSTGRES_DB=cigtracker

# Expose the default PostgreSQL port
EXPOSE 5432