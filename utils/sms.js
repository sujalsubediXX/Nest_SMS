const GSM_CHARS =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_SET = new Set(GSM_CHARS);

export default function countPart(message){
    const isGSM = [...message].every((c)=>GSM_SET.has(c));
    const length = message.length;
    const single = isGSM ? 160 : 70;
    const perPart = isGSM ? 153 : 67;

    const totalParts = length <= single ?1: Math.ceil(length / perPart);

    return {totalParts, encoding: isGSM ? 'GSM-7' : 'Unicode'};

}

