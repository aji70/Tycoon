allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
    project.evaluationDependsOn(":app")

    // privy_flutter 0.7.0: duplicate DI namespace (privy-core-di-component vs kmp-di-component-android).
    configurations.configureEach {
        exclude(group = "io.privy", module = "privy-core-di-component")
    }

}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
