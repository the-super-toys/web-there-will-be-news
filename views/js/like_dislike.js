function like(id) {
    let counter = document.getElementById(`${id}_like_counter`);
    if (counter.className === "selected") return;

    counter.textContent = parseInt(counter.textContent) + 1;
    counter.className = "selected";

    let icon = document.getElementById(`${id}_like_icon`);
    icon.className = icon.className + " selected";

    document.getElementById(`${id}_dislike_counter`).className = 'text-muted';

    let iconDislike = document.getElementById(`${id}_dislike_icon`);
    iconDislike.className = iconDislike.className.replace(" selected", "");

    if (getCookie(`state_like${id}`) === 'dislike') {
        let counter = document.getElementById(`${id}_dislike_counter`);
        counter.textContent = parseInt(counter.textContent) - 1;
    }

    makeHttpCall(id, 'like');
}

function dislike(id) {
    let counter = document.getElementById(`${id}_dislike_counter`);
    if (counter.className === "selected") return;

    counter.textContent = parseInt(counter.textContent) + 1;
    counter.className = "selected";

    let icon = document.getElementById(`${id}_dislike_icon`);
    icon.className = icon.className + " selected";

    document.getElementById(`${id}_like_counter`).className = 'text-muted';

    let iconLike = document.getElementById(`${id}_like_icon`);
    iconLike.className = iconLike.className.replace(" selected", "");

    if (getCookie(`state_like${id}`) === 'like') {
        let counter = document.getElementById(`${id}_like_counter`);
        counter.textContent = parseInt(counter.textContent) - 1;
    }

    makeHttpCall(id, 'dislike');
}

function makeHttpCall(id, method) {
    let http = new XMLHttpRequest();
    http.open("POST", `${window.location.origin}/${method}/${id}`);
    http.send();
}

function getCookie(name) {
    let value = "; " + document.cookie;
    let parts = value.split("; " + name + "=");
    if (parts.length === 2) return parts.pop().split(";").shift();
}