FROM eclipse-mosquitto:2

COPY mosquitto.conf /mosquitto/config/mosquitto.conf

# Allow non-root
USER mosquitto

EXPOSE 1883 9001