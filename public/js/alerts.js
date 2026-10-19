(function () {
  if (!window.Swal) return;

  const defaults = {
    buttonsStyling: false,
    customClass: {
      popup: 'fest-swal',
      confirmButton: 'fest-swal__confirm',
      cancelButton: 'fest-swal__cancel',
      title: 'fest-swal__title',
      htmlContainer: 'fest-swal__content'
    },
    focusConfirm: false,
    allowOutsideClick: true,
    confirmButtonText: 'OK',
    cancelButtonText: 'Cancelar',
    reverseButtons: true
  };

  const show = (config) => window.Swal.fire({ ...defaults, ...config });

  window.FestAlert = {
    success(title, text) {
      return show({ icon: 'success', title, text, confirmButtonText: 'OK' });
    },
    error(title, text) {
      return show({ icon: 'error', title, text, confirmButtonText: 'Entendi' });
    },
    warning(title, text) {
      return show({ icon: 'warning', title, text, confirmButtonText: 'Entendi' });
    },
    info(title, text) {
      return show({ icon: 'info', title, text, confirmButtonText: 'OK' });
    },
    confirm(title, text, options = {}) {
      return show({
        icon: 'question',
        title,
        text,
        showCancelButton: true,
        confirmButtonText: options.confirmText || 'Confirmar',
        cancelButtonText: options.cancelText || 'Cancelar',
        ...options
      });
    },
    loading(title = 'Processando...') {
      return show({
        title,
        allowOutsideClick: false,
        showConfirmButton: false,
        showCancelButton: false,
        didOpen: () => window.Swal.showLoading()
      });
    },
    close() {
      window.Swal.close();
    }
  };

  window.alert = function (message) {
    const text = message == null ? '' : String(message);
    return window.Swal.fire({
      ...defaults,
      icon: 'info',
      title: 'Atenção',
      text,
      confirmButtonText: 'OK'
    });
  };
})();
