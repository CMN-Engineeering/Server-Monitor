const t1 = "12:00:00 26/6/26";
const t2 = "13:00:00 26/6/26";

function parseDate(str) {
  const [time, date] = str.split(" ");
  const [hour, minute, second] = time.split(":").map(Number);
  const [day, month, year] = date.split("/").map(Number);

  return new Date(2000 + year, month - 1, day, hour, minute, second);
}

const diffSeconds = (parseDate(t2) - parseDate(t1)) / 1000;

console.log(diffSeconds); // 3600