#!/command/with-contenv bash

# Uncomment meta "upgrade-insecure-requests" if env variable USE_HTTPS_PROXY is set to true to force all requests to be https 
# (See [CSP: upgrade-insecure-requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/upgrade-insecure-requests))
if [[ ${USE_HTTPS_PROXY} == "1" ]]
then
  echo "[satviewer][USE_HTTPS_PROXY] Uncomment meta upgrade-insecure-requests to true to force all requests to be https"
  sed -i 's/<\!--<meta http-equiv=\"Content-Security-Policy\" content=\"upgrade-insecure-requests\"\>--\>/<meta http-equiv=\"Content-Security-Policy\" content=\"upgrade-insecure-requests\"\>/' /app/index.html
fi
