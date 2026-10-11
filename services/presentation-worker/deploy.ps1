$ErrorActionPreference = 'Stop'
$project = 'prodigitaltv-da47b'
$region = 'europe-west3'
$account = 'presentation-worker@prodigitaltv-da47b.iam.gserviceaccount.com'
$bucketName = 'prodigitaltv-da47b-presentations'
$bucket = "gs://$bucketName"
$image = 'europe-west3-docker.pkg.dev/prodigitaltv-da47b/cloud-run-source-deploy/presentation-worker:20261010'
# Nutzerfreigabe: Cloud-Rechte und Veröffentlichung am 10.10.2026.
function Invoke-Gcloud { param([string[]]$Arguments) & gcloud @Arguments; if ($LASTEXITCODE -ne 0) { throw 'Cloud-Bereitstellung fehlgeschlagen.' } }
& gcloud iam service-accounts describe $account "--project=$project" --format='value(email)' 2>$null
if ($LASTEXITCODE -ne 0) { Invoke-Gcloud @('iam','service-accounts','create','presentation-worker',"--project=$project",'--display-name=PROdigitalTV Präsentationskonvertierung') }
& gcloud storage buckets describe $bucket --format='value(name)' 2>$null
if ($LASTEXITCODE -ne 0) { Invoke-Gcloud @('storage','buckets','create',$bucket,"--project=$project","--location=$region",'--uniform-bucket-level-access','--public-access-prevention','--quiet') }
Invoke-Gcloud @('storage','buckets','update',$bucket,"--cors-file=$PSScriptRoot/cors.json",'--quiet')
Invoke-Gcloud @('projects','add-iam-policy-binding',$project,"--member=serviceAccount:$account",'--role=roles/datastore.user','--condition=None','--quiet','--format=value(version)')
$condition = "expression=resource.name.startsWith('projects/_/buckets/$bucketName/objects/presentations/'),title=presentation_objects_only"
Invoke-Gcloud @('storage','buckets','add-iam-policy-binding',$bucket,"--member=serviceAccount:$account",'--role=roles/storage.objectUser',"--condition=$condition",'--quiet','--format=value(version)')
Invoke-Gcloud @('iam','service-accounts','add-iam-policy-binding',$account,"--project=$project","--member=serviceAccount:$account",'--role=roles/iam.serviceAccountTokenCreator','--quiet','--format=value(version)')
Invoke-Gcloud @('run','deploy','presentation-worker',"--project=$project","--region=$region","--image=$image","--service-account=$account",'--cpu=2','--memory=2Gi','--concurrency=1','--max-instances=2','--min-instances=0','--timeout=600',"--set-env-vars=GOOGLE_CLOUD_PROJECT=$project,STORAGE_BUCKET=$bucketName,SIGNING_ACCOUNT=$account",'--allow-unauthenticated','--quiet')
# Die Anwendung prüft Firebase-Token, CMS-Rolle und Freigabe. Vorherigen Medien-Bucket und dessen Regeln nicht ändern.
# Hosting separat mit tmp/deploy-presentation.cjs gezielt veröffentlichen; keine vollständige lokale Kopie hochladen.
