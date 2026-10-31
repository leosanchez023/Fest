(function () {
  if (!window.Swal) return;

  const defaults = {
    buttonsStyling: false,
    customClass: {
      container: 'fest-swal-container',
      popup: 'fest-swal',
      confirmButton: 'fest-swal__confirm',
      cancelButton: 'fest-swal__cancel',
      title: 'fest-swal__title',
      htmlContainer: 'fest-swal__content'
    },
    focusConfirm: false,
    allowOutsideClick: true,
    position: 'center',
    confirmButtonText: 'OK',
    cancelButtonText: 'Cancelar',
    reverseButtons: true
  };

  const show = (config) => window.Swal.fire({ ...defaults, ...config });
  const toast = (icon, title, text) => window.Swal.fire({
    ...defaults,
    icon,
    title,
    text,
    toast: true,
    position: 'top-end',
    timer: 2500,
    timerProgressBar: true,
    showConfirmButton: false,
    showCloseButton: true,
    customClass: {
      ...defaults.customClass,
      container: 'fest-swal-container fest-swal-container--toast',
      popup: 'fest-swal fest-swal--toast'
    }
  });

  window.FestAlert = {
    success(title, text) {
      return toast('success', title, text);
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
