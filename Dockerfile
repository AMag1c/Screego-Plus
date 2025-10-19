FROM scratch
USER 1001
COPY screego /screego
EXPOSE 3478/tcp
EXPOSE 3478/udp
EXPOSE 9100
EXPOSE 9101
WORKDIR "/"
ENTRYPOINT [ "/screego" ]
CMD ["serve"]
