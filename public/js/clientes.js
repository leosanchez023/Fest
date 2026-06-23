function openForm() {
  const form = document.getElementById("formulariocard");

  if (form.style.display === "none") {
    form.style.display = "block";
  } else {
    form.style.display = "none";
  }
}