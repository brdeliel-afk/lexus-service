# מזכיר שירות לקסוס — PWA

## התקנה ופריסה

### שלב 1: GitHub
1. כנס ל-github.com
2. לחץ **New repository**
3. שם: `lexus-service`
4. לחץ **Create repository**
5. פתח Terminal בתיקיית הפרויקט:

```bash
cd lexus-service
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/lexus-service.git
git push -u origin main
```

---

### שלב 2: Vercel
1. כנס ל-vercel.com
2. לחץ **Add New → Project**
3. בחר את `lexus-service` מ-GitHub
4. Framework Preset: **Create React App**
5. לחץ **Deploy**
6. תוך 2 דקות תקבל קישור — לדוגמה: `https://lexus-service.vercel.app`

---

### שלב 3: התקנה על הטלפון כ-PWA

**Android (Chrome):**
1. פתח את הקישור ב-Chrome
2. תפריט ⋮ → **הוסף למסך הבית**
3. אשר את ההתקנה
4. האפליקציה תופיע כאייקון על המסך

**iPhone (Safari):**
1. פתח את הקישור ב-Safari
2. לחץ על כפתור השיתוף
3. **הוסף למסך הבית**
4. אשר

---

### שלב 4: אפשר התראות
בפעם הראשונה שתפתח את האפליקציה, תופיע בקשה לאפשר התראות.
אשר אותה — זה מה שמאפשר תזכורות גם כשהמסך נעול.

---

## עדכונים עתידיים
כל `git push` ל-main ידרס אוטומטית את הגרסה ב-Vercel.
