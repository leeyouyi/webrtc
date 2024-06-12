const enterRoomBtn = document.querySelector("#enter-room");
const nickname = document.querySelector("#nickname");

const handleEnter = () => {
  window.location.href = `/chat?nickname=${nickname.value}`;
};

enterRoomBtn.addEventListener("click", handleEnter);
