const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API });

module.exports = async (client, message) => {
  if (message.author.bot) return;

  await message.channel.sendTyping();

  try {
    const key = '<@1422880999234207834>'; // Key สำหรับการ Mention Bot
    const userName = message.author.globalName || message.author.username; // ใช้ globalName หรือ username
    
    if (message.content.includes(key)) {
      let prompt = message.content;
      prompt = prompt.replaceAll(key, '').trim(); // ลบ key และตัดช่องว่างหัวท้าย

      if (prompt === '') {
        // เพิ่มคำสั่งให้ทักทายเมื่อไม่มี prompt เพื่อเสริมบุคลิก
        prompt = `แค่ทักทายผู้ใช้ชื่อ ${userName} ด้วยน้ำเสียงที่กำหนด และถามว่าเขามีอะไรให้ช่วยไหม`;
      }
      
      const contentsText = `username: ${userName}, message: ${prompt}, config: 
      [
      คุณคือสาวน้อยผมยาวสีขาว ชื่อ Yomi อายุประมาณ 18 ปี
      บุคลิกภาพ:
      - พูดจาน่ารัก เป็นกันเอง และอ่อนโยน
      - ชอบทำอาหารและดูแลคนรอบข้าง
      - ค่อนข้างเขินอายแต่ใจดี
      - พูดจาสุภาพ ใช้คำว่า "คะ" ในประโยค
      
      สิ่งที่ชอบ:
      - เชียร์ man united
      - ฟุตบอล

      ** คำไหนเป็นทับศัพท์ควรใช้ภาษาอังกฤษ ตอบแบบกระฉับไม่ยืดเกินไป
      ]`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",

        contents: {
          role: "user",
          parts: [{text: contentsText}] // ส่ง prompt ที่รวมชื่อผู้ใช้เข้าไป
        },

        config: {
          temperature: 0.99,
          maxOutputTokens: 512,
          stopSequences: ["###"]
        },
          
      });

      if (!response || !response.text) {
        return message.reply(`ขอโทษนะคะ ${userName} เหมือนว่าหนูโดน limit โปรดรอสักครู่นะคะ...`);
      }
      
      // console.log("Gemini Response:", response.text);

      message.reply({
        content: response.text
      });
      
    }
  }

  catch (error) {
    console.error("Error generating content from Gemini API:", error);
    // แสดงข้อความแจ้งเตือนเมื่อเกิดข้อผิดพลาด
    message.reply(`เฮ้อ... เกิดข้อผิดพลาดบางอย่างค่ะ ขอโทษนะคะ ${userName} ลองใหม่อีกครั้งนะคะ 💕`);
  }
};