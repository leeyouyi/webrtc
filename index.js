const enterRoomBtn = document.querySelector("#enter-room");
const nickname = document.querySelector("#nickname");

const handleEnter = () => {
  // fetch("/chat.html", { method: "GET" })
  //   .then((res) => {
  //     console.log(res);
  //     if (res.ok) {
  //       return res.text();
  //     }
  //   })
  //   .then((html) => {
  //     console.log(html);
  //     return (document.body.innerHTML = html);
  //   })
  //   .catch((error) => {
  //     console.log(error);
  //   });
  window.location.href = `/chat?nickname=${nickname.value}`;
};

enterRoomBtn.addEventListener("click", handleEnter);
