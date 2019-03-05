FROM node
RUN /usr/local/bin/npm install parallel-proxy -g
CMD /usr/local/bin/parallel-proxy