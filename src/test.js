import { publicIpv4 } from "public-ip";
const ipv4 = await publicIpv4();
console.log(ipv4);