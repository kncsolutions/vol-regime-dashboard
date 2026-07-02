PAGE_TEMPLATE = """
<!DOCTYPE html>

<html>

<head>

<meta charset="utf-8">

<title>{title}</title>

<link rel="stylesheet" href="../assets/style.css">

</head>

<body>

<div class="container">

<h1>{title}</h1>

{navigation}

{content}

</div>

</body>

</html>
"""


INDEX_TEMPLATE = """
<!DOCTYPE html>

<html>

<head>

<meta charset="utf-8">

<title>Market Memory Library</title>

<link rel="stylesheet" href="assets/style.css">

</head>

<body>

<div class="container">

<h1>Market Memory Library</h1>

{content}

</div>

</body>

</html>
"""