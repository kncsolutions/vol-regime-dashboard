const ALLOWED_USERS = [
    "pallavagt@gmail.com",
    "kncsolns@gmail.com"
]

let auth = null
window.FIREBASE_TOKEN = null

async function initFirebase() {


    const response = await fetch("firebaseConfig.json")
    const firebaseConfig = await response.json()

    firebase.initializeApp(firebaseConfig)

    auth = firebase.auth()

    startAuthListener()


}

function startAuthListener() {

    auth.onIdTokenChanged(async (user) => {

        if (user) {

            // restrict access to allowed users
            if (!ALLOWED_USERS.includes(user.email)) {
                alert("Access denied")
                await auth.signOut()
                return
            }

            const token = await user.getIdToken()
            window.FIREBASE_TOKEN = token

            console.log("🔄 Token updated")


            // redirect login page → dashboard
            if (window.location.pathname.includes("login")) {
                window.location.href = "index.html"
                return
            }

            const dash = document.getElementById("dashboard")
            if (dash) dash.style.display = "block"

            const loading = document.getElementById("loading")
            if (loading) loading.style.display = "none"

            if (typeof initDashboard === "function") {
                initDashboard()
            }

        } else {

            // redirect to login if not authenticated
            if (!window.location.pathname.includes("login")) {
                window.location.href = "login.html"
            }

        }

    })


}

async function getFreshToken() {

    const user = auth.currentUser
    if (!user) return null

    try {
        const token = await user.getIdToken()
        window.FIREBASE_TOKEN = token
        return token
    } catch (e) {
        console.warn("Token fetch failed, forcing refresh")

        const token = await user.getIdToken(true)
        window.FIREBASE_TOKEN = token
        return token
    }
}

// LOGIN
async function login() {


    const provider = new firebase.auth.GoogleAuthProvider()
    await auth.signInWithPopup(provider)


}

// LOGOUT
function logout() {


    auth.signOut()
    window.location.href = "login.html"


}

// start firebase
initFirebase()
